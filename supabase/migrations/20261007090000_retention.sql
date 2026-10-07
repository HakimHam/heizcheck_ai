-- The retention job (ticket 15): Statement Packages, their PDFs and their
-- Check Reports are deleted 4 years after they were created. That covers the
-- 12-month objection window (§556 para 3 sentence 5 BGB) plus the 3-year
-- limitation period (§195 BGB).
--
-- The job runs in two steps, with the same `p_now` for both:
--   1. expired_statement_package_files lists the PDFs to remove; the app
--      removes them through the Storage API, which also deletes the files
--      themselves, not just their storage.objects rows.
--   2. delete_expired_statement_packages deletes the packages, their PDF rows
--      and their Check Reports.
-- PDFs go first: if step 2 fails, the rows stay and the next run retries both
-- steps. The other way round, a failed removal would leave PDFs nothing points
-- to, and nothing would ever delete them.
--
-- Only the service role (the scheduled job) can call either function.

-- The packages the retention job deletes at `p_now`. A package expires once
-- it and its Check Report are both at least 4 years old: the Check Report is
-- created at confirmation, after the package, and is kept its full 4 years.
-- A package a kept package points to as superseded_by is kept with it, so the
-- correction history never points at nothing; it expires with the last one
-- that points to it.
create function private.expired_statement_package_ids(p_now timestamptz)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive kept (id) as (
    select p.id
      from public.statement_packages p
      left join public.check_reports r on r.statement_package_id = p.id
     -- 4 years: §556 para 3 sentence 5 BGB (12 months) + §195 BGB (3 years).
     where greatest(p.created_at, r.created_at) > p_now - interval '4 years'
    union
    select p.superseded_by
      from public.statement_packages p
      join kept on kept.id = p.id
     where p.superseded_by is not null
  )
  select p.id from public.statement_packages p
   where p.id not in (select id from kept)
$$;

-- The storage paths of the PDFs the retention job removes at `p_now`. One
-- array, not a set of rows: the Data API cuts sets off at its max-rows limit,
-- and a PDF missing from this list would outlive its package.
create function public.expired_statement_package_files(p_now timestamptz)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select f.storage_path
      from public.statement_package_files f
     where f.statement_package_id in (select private.expired_statement_package_ids(p_now))
     order by f.storage_path
  )
$$;

-- Deletes the packages that expired at `p_now`, with their PDF rows and Check
-- Reports, and returns how many packages it deleted.
create function public.delete_expired_statement_packages(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired uuid[] := array(select private.expired_statement_package_ids(p_now));
  deleted integer;
begin
  perform set_config('heizcheck.retention_running', 'on', true);
  delete from public.check_reports where statement_package_id = any (expired);
  delete from public.statement_package_files where statement_package_id = any (expired);
  delete from public.statement_packages where id = any (expired);
  get diagnostics deleted = row_count;
  perform set_config('heizcheck.retention_running', '', true);
  return deleted;
end;
$$;

revoke all on function private.expired_statement_package_ids(timestamptz) from public;
revoke all on function public.expired_statement_package_files(timestamptz) from public, anon, authenticated;
revoke all on function public.delete_expired_statement_packages(timestamptz) from public, anon, authenticated;
grant execute on function public.expired_statement_package_files(timestamptz) to service_role;
grant execute on function public.delete_expired_statement_packages(timestamptz) to service_role;

-- The retention job is the only thing that deletes a Check Report: not the
-- app, not the service role, not a cascade from a deleted Organisation. The
-- Data API exposes no way to call set_config, so no client can set the flag.
create function private.forbid_check_report_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('heizcheck.retention_running', true) is distinct from 'on' then
    raise exception 'Check Reports are deleted only by the retention job';
  end if;
  return old;
end;
$$;

revoke all on function private.forbid_check_report_delete() from public;

create trigger check_reports_retention_only
  before delete on public.check_reports
  for each row execute function private.forbid_check_report_delete();

-- A package uploaded 4 years ago has expired and can't be checked any more.
-- The retention job removes its PDFs in one call and deletes its rows in the
-- next; without this, confirming it in between would keep a package and a new
-- Check Report whose PDFs are already gone. Confirming is the Property
-- Manager's step before dispatch, so a 4-year-old upload is never confirmed
-- for real.
create function private.refuse_expired_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 4 years: §556 para 3 sentence 5 BGB (12 months) + §195 BGB (3 years).
  if exists (
    select 1 from public.statement_packages
     where id = new.statement_package_id and created_at <= now() - interval '4 years'
  ) then
    raise exception 'A Statement Package uploaded 4 years ago has expired and can''t be checked';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_expired_check() from public;

create trigger check_reports_refuse_expired
  before insert on public.check_reports
  for each row execute function private.refuse_expired_check();
