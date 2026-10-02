-- Statement Packages, their PDFs and their Check Reports.
--
-- A package moves through
--   uploaded → extracting → awaiting_confirmation → confirmed → checked
-- with extraction_failed → extracting as the retry. The triggers below enforce
-- that order, lock the Confirmed Figures once confirmed, and keep Check
-- Reports append-only, so the app can't break them by mistake.

create table public.statement_packages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    default private.current_organisation_id()
    references public.organisations (id) on delete cascade,
  building_id uuid not null references public.buildings (id),
  -- When the Unit Statements go to Tenants (§556 para 3 BGB).
  dispatch_date date not null,
  status text not null default 'uploaded' check (status in (
    'uploaded', 'extracting', 'extraction_failed', 'awaiting_confirmation', 'confirmed', 'checked'
  )),
  -- What the Extractor read, and where in the PDFs each figure appears.
  extracted_figures jsonb,
  extracted_sources jsonb,
  -- The Property Manager's confirmed snapshot: the only input the rules use.
  confirmed_figures jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check ((status in ('awaiting_confirmation', 'confirmed', 'checked')) = (extracted_figures is not null)),
  check ((extracted_figures is null) = (extracted_sources is null)),
  check ((status in ('confirmed', 'checked')) = (confirmed_figures is not null)),
  check ((confirmed_figures is null) = (confirmed_at is null))
);

create index statement_packages_building_id_idx on public.statement_packages (building_id);
create index statement_packages_organisation_id_idx on public.statement_packages (organisation_id);

create table public.statement_package_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    default private.current_organisation_id()
    references public.organisations (id) on delete cascade,
  statement_package_id uuid not null references public.statement_packages (id) on delete cascade,
  -- Upload order, from 1. The Extractor reads the PDFs in this order.
  position integer not null check (position > 0),
  -- As the Property Manager named it.
  file_name text not null check (length(trim(file_name)) > 0),
  size_bytes bigint not null check (size_bytes > 0),
  -- Set by the trigger below: <organisation>/<package>/<position>.pdf
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  unique (statement_package_id, position)
);

create table public.check_reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    default private.current_organisation_id()
    references public.organisations (id) on delete cascade,
  -- One Check Report per package. A corrected package is a new package.
  statement_package_id uuid not null unique references public.statement_packages (id),
  -- Copied from the package by the trigger below.
  building_id uuid not null references public.buildings (id),
  dispatch_date date not null,
  confirmed_figures jsonb not null,
  -- The Building Profile as it was when checked; later edits don't reach it.
  building_profile jsonb not null,
  ruleset_version text not null check (length(ruleset_version) > 0),
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  created_at timestamptz not null default now()
);

create index check_reports_building_id_idx on public.check_reports (building_id);

-- Access: members of the owning Organisation only. Nothing is deleted from the
-- app; the retention job (ticket 15) deletes after 4 years.

alter table public.statement_packages enable row level security;
alter table public.statement_package_files enable row level security;
alter table public.check_reports enable row level security;

create policy "Members read their Organisation's Statement Packages"
  on public.statement_packages for select to authenticated
  using (organisation_id = (select private.current_organisation_id()));

create policy "Members upload Statement Packages for their Organisation's buildings"
  on public.statement_packages for insert to authenticated
  with check (
    organisation_id = (select private.current_organisation_id())
    and exists (select 1 from public.buildings b where b.id = building_id)
  );

create policy "Members work on their Organisation's Statement Packages"
  on public.statement_packages for update to authenticated
  using (organisation_id = (select private.current_organisation_id()))
  with check (organisation_id = (select private.current_organisation_id()));

create policy "Members read their Organisation's statement PDFs"
  on public.statement_package_files for select to authenticated
  using (organisation_id = (select private.current_organisation_id()));

create policy "Members add PDFs to their Organisation's Statement Packages"
  on public.statement_package_files for insert to authenticated
  with check (
    organisation_id = (select private.current_organisation_id())
    and exists (select 1 from public.statement_packages p where p.id = statement_package_id)
  );

create policy "Members read their Organisation's Check Reports"
  on public.check_reports for select to authenticated
  using (organisation_id = (select private.current_organisation_id()));

create policy "Members check their Organisation's Statement Packages"
  on public.check_reports for insert to authenticated
  with check (organisation_id = (select private.current_organisation_id()));

revoke all on public.statement_packages from anon;
revoke all on public.statement_package_files from anon;
revoke all on public.check_reports from anon;
revoke delete on public.statement_packages from authenticated;
revoke update, delete on public.statement_package_files from authenticated;
revoke update, delete on public.check_reports from authenticated;

-- A new package starts empty, as uploaded, and only for a building in scope.
create function private.check_new_statement_package()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_residential boolean;
begin
  if new.status <> 'uploaded' or new.extracted_figures is not null or new.confirmed_figures is not null then
    raise exception 'A Statement Package starts as uploaded, without figures';
  end if;
  -- Runs as the user, so another Organisation's building is not found.
  select residential into is_residential from public.buildings where id = new.building_id;
  if not found then
    raise exception 'Building % not found', new.building_id;
  end if;
  if not is_residential then
    raise exception 'Building % is out of scope: not residential', new.building_id;
  end if;
  return new;
end;
$$;

create trigger statement_packages_check_new
  before insert on public.statement_packages
  for each row execute function private.check_new_statement_package();

-- Each step of the lifecycle may change only what that step produces.
create function private.check_statement_package_step()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id
    or new.building_id is distinct from old.building_id
    or new.dispatch_date is distinct from old.dispatch_date
    or new.created_at is distinct from old.created_at then
    raise exception 'A Statement Package''s building and Dispatch Date cannot change';
  end if;

  if new.status <> old.status and (old.status, new.status) not in (
    ('uploaded', 'extracting'),
    ('extracting', 'awaiting_confirmation'),
    ('extracting', 'extraction_failed'),
    ('extraction_failed', 'extracting'),
    ('awaiting_confirmation', 'confirmed'),
    ('confirmed', 'checked')
  ) then
    raise exception 'A Statement Package cannot go from % to %', old.status, new.status;
  end if;

  if (new.extracted_figures is distinct from old.extracted_figures
      or new.extracted_sources is distinct from old.extracted_sources)
    and not (old.status = 'extracting' and new.status = 'awaiting_confirmation') then
    raise exception 'Extracted Figures are written only when extraction finishes';
  end if;

  if (new.confirmed_figures is distinct from old.confirmed_figures
      or new.confirmed_at is distinct from old.confirmed_at)
    and not (old.status = 'awaiting_confirmation' and new.status = 'confirmed') then
    raise exception 'Confirmed Figures cannot change once confirmed';
  end if;

  -- Only confirm_statement_package confirms, so a package is never left
  -- confirmed without its Check Report. Clients can't set this setting: the
  -- Data API exposes no way to call set_config.
  if new.status = 'confirmed' and old.status <> 'confirmed'
    and current_setting('heizcheck.confirming_package', true) is distinct from new.id::text then
    raise exception 'A Statement Package is confirmed only through confirm_statement_package';
  end if;

  if new.status = 'checked' and old.status <> 'checked'
    and not exists (select 1 from public.check_reports where statement_package_id = new.id) then
    raise exception 'A Statement Package is checked only once its Check Report exists';
  end if;

  return new;
end;
$$;

create trigger statement_packages_check_step
  before update on public.statement_packages
  for each row execute function private.check_statement_package_step();

create trigger statement_packages_touch_updated_at
  before update on public.statement_packages
  for each row execute function private.touch_updated_at();

-- PDFs are added only while the package is being uploaded, at a path the
-- storage policies below tie to the Organisation.
create function private.place_statement_package_file()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  package_status text;
begin
  select status into package_status
    from public.statement_packages where id = new.statement_package_id;
  if package_status is distinct from 'uploaded' then
    raise exception 'PDFs can only be added while a Statement Package is uploaded';
  end if;
  new.storage_path := new.organisation_id || '/' || new.statement_package_id || '/' || new.position || '.pdf';
  return new;
end;
$$;

create trigger statement_package_files_place
  before insert on public.statement_package_files
  for each row execute function private.place_statement_package_file();

-- A Check Report is based on exactly what was confirmed, and marks the
-- package checked.
create function private.check_new_check_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  package public.statement_packages%rowtype;
  stored_profile jsonb;
begin
  select * into package from public.statement_packages
   where id = new.statement_package_id for update;
  if not found or package.status <> 'confirmed' then
    raise exception 'Only a confirmed Statement Package can be checked';
  end if;
  if new.confirmed_figures is distinct from package.confirmed_figures then
    raise exception 'A Check Report must be based on the Confirmed Figures';
  end if;
  -- The snapshot must be the Building Profile as stored, in the app's shape
  -- (src/lib/building-profile.ts). jsonb compares numbers by value, so 790.50
  -- equals the app's 790.5.
  select jsonb_build_object(
           'livingAreaM2', living_area_m2,
           'heatedAreaM2', heated_area_m2,
           'mandatory70Pct', mandatory_70_pct,
           'residential', residential,
           'co2Reduction', co2_reduction)
    into stored_profile
    from public.buildings where id = package.building_id;
  if new.building_profile is distinct from stored_profile then
    raise exception 'A Check Report must hold the Building Profile as stored';
  end if;
  new.organisation_id := package.organisation_id;
  new.building_id := package.building_id;
  new.dispatch_date := package.dispatch_date;
  return new;
end;
$$;

create trigger check_reports_check_new
  before insert on public.check_reports
  for each row execute function private.check_new_check_report();

create function private.mark_statement_package_checked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.statement_packages set status = 'checked' where id = new.statement_package_id;
  return null;
end;
$$;

create trigger check_reports_mark_checked
  after insert on public.check_reports
  for each row execute function private.mark_statement_package_checked();

-- Append-only, for everyone: the grants above stop the app, this stops the rest.
create function private.forbid_check_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Check Reports cannot be changed';
end;
$$;

create trigger check_reports_append_only
  before update on public.check_reports
  for each row execute function private.forbid_check_report_update();

revoke all on function private.check_new_statement_package() from public;
revoke all on function private.check_statement_package_step() from public;
revoke all on function private.place_statement_package_file() from public;
revoke all on function private.check_new_check_report() from public;
revoke all on function private.mark_statement_package_checked() from public;
revoke all on function private.forbid_check_report_update() from public;

-- Confirms a package and stores its Check Report in one transaction, so a
-- package is never left confirmed without one. The check engine runs in the
-- app; `p_results` is its output for `p_confirmed_figures` and
-- `p_building_profile`. The database checks the figures and the profile
-- snapshot, but can't rerun the rules: a member calling this directly could
-- store results of their own. Members are trusted within their Organisation;
-- RLS keeps everyone else out.
create function public.confirm_statement_package(
  p_package_id uuid,
  p_confirmed_figures jsonb,
  p_building_profile jsonb,
  p_ruleset_version text,
  p_results jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  report_id uuid;
begin
  perform set_config('heizcheck.confirming_package', p_package_id::text, true);
  update public.statement_packages
     set status = 'confirmed', confirmed_figures = p_confirmed_figures, confirmed_at = now()
   where id = p_package_id and status = 'awaiting_confirmation';

  insert into public.check_reports
    (statement_package_id, confirmed_figures, building_profile, ruleset_version, results)
  values (p_package_id, p_confirmed_figures, p_building_profile, p_ruleset_version, p_results)
  returning id into report_id;

  perform set_config('heizcheck.confirming_package', '', true);
  return report_id;
end;
$$;

revoke all on function public.confirm_statement_package(uuid, jsonb, jsonb, text, jsonb) from public, anon;
grant execute on function public.confirm_statement_package(uuid, jsonb, jsonb, text, jsonb) to authenticated;

-- PDF storage, in the Supabase project's region (Frankfurt). Objects live
-- under <organisation>/<package>/ and can only be written to a path registered
-- in statement_package_files, while the package is being uploaded. No update
-- or delete policy: PDFs are kept.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statement-packages', 'statement-packages', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "Members read their Organisation's statement PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'statement-packages'
    and (storage.foldername(name))[1] = (select private.current_organisation_id())::text
  );

create policy "Members upload registered statement PDFs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statement-packages'
    and (storage.foldername(name))[1] = (select private.current_organisation_id())::text
    and exists (
      select 1
        from public.statement_package_files f
        join public.statement_packages p on p.id = f.statement_package_id
       where f.storage_path = name and p.status = 'uploaded'
    )
  );
