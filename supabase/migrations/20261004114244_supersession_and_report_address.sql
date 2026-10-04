-- Corrected packages (ticket 14) and the building's address in each Check
-- Report.
--
-- A corrected Statement Package from the Metering Provider supersedes the
-- previous one for the same building and Billing Period. The Billing Period
-- is a Confirmed Figure, so supersession happens when a package is confirmed:
-- of all confirmed packages for that building and Billing Period, the newest
-- upload is current and each other current one is marked superseded by it.
-- Nothing is deleted, and a package stays superseded.

alter table public.statement_packages
  add column superseded_by uuid references public.statement_packages (id),
  add constraint statement_packages_not_superseded_by_itself check (superseded_by <> id);

create index statement_packages_superseded_by_idx on public.statement_packages (superseded_by);

-- The address as it was when checked, in the app's shape
-- (src/lib/building-profile.ts), so editing the building later doesn't change
-- how an old Check Report reads. Set by the trigger below, never by the caller.
alter table public.check_reports add column address jsonb;

-- Backfill existing reports from their building. Check Reports are otherwise
-- append-only.
alter table public.check_reports disable trigger check_reports_append_only;
update public.check_reports r
   set address = jsonb_build_object('street', b.street, 'postalCode', b.postal_code, 'city', b.city)
  from public.buildings b
 where b.id = r.building_id;
alter table public.check_reports enable trigger check_reports_append_only;

alter table public.check_reports alter column address set not null;

create or replace function private.check_new_statement_package()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_residential boolean;
begin
  if new.status <> 'uploaded' or new.extracted_figures is not null or new.confirmed_figures is not null
    or new.superseded_by is not null then
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

-- As before, plus: a package is superseded only while confirm_statement_package
-- runs, and never un-superseded.
create or replace function private.check_statement_package_step()
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

  if new.superseded_by is distinct from old.superseded_by
    and (old.superseded_by is not null
      or coalesce(current_setting('heizcheck.confirming_package', true), '') = '') then
    raise exception 'A Statement Package is superseded only by confirming its correction';
  end if;

  return new;
end;
$$;

-- As before, plus the address snapshot.
create or replace function private.check_new_check_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  package public.statement_packages%rowtype;
  stored_profile jsonb;
  stored_address jsonb;
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
           'co2Reduction', co2_reduction),
         jsonb_build_object('street', street, 'postalCode', postal_code, 'city', city)
    into stored_profile, stored_address
    from public.buildings where id = package.building_id;
  if new.building_profile is distinct from stored_profile then
    raise exception 'A Check Report must hold the Building Profile as stored';
  end if;
  new.organisation_id := package.organisation_id;
  new.building_id := package.building_id;
  new.dispatch_date := package.dispatch_date;
  new.address := stored_address;
  return new;
end;
$$;

-- As before, plus supersession once the Check Report is stored.
create or replace function public.confirm_statement_package(
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
  package_building_id uuid;
  billing_period jsonb := p_confirmed_figures -> 'building' -> 'billingPeriod';
  current_id uuid;
begin
  perform set_config('heizcheck.confirming_package', p_package_id::text, true);
  update public.statement_packages
     set status = 'confirmed', confirmed_figures = p_confirmed_figures, confirmed_at = now()
   where id = p_package_id and status = 'awaiting_confirmation';

  insert into public.check_reports
    (statement_package_id, confirmed_figures, building_profile, ruleset_version, results)
  values (p_package_id, p_confirmed_figures, p_building_profile, p_ruleset_version, p_results)
  returning id, building_id into report_id, package_building_id;

  -- An unknown Billing Period matches nothing: it can't be the same period.
  if jsonb_typeof(billing_period) = 'object' then
    -- Two corrections confirmed at once would each miss the other and both
    -- stay current; one at a time per building, each sees what the last stored.
    perform pg_advisory_xact_lock(hashtextextended(package_building_id::text, 0));
    select id into current_id
      from public.statement_packages
     where building_id = package_building_id
       and confirmed_figures -> 'building' -> 'billingPeriod' = billing_period
     order by created_at desc, id desc
     limit 1;
    update public.statement_packages
       set superseded_by = current_id
     where building_id = package_building_id
       and confirmed_figures -> 'building' -> 'billingPeriod' = billing_period
       and id <> current_id
       and superseded_by is null;
  end if;

  perform set_config('heizcheck.confirming_package', '', true);
  return report_id;
end;
$$;
