-- Buildings and their Building Profile: the true facts the Metering Provider
-- doesn't supply. The profile lives on the building row because it is reused
-- across Billing Periods; each Check Report will copy it into its snapshot.
--
-- A null fact means "unknown" and leads to Not assessable. It is never
-- replaced by a default.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    default private.current_organisation_id()
    references public.organisations (id) on delete cascade,
  street text not null check (length(trim(street)) > 0),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null check (length(trim(city)) > 0),

  living_area_m2 numeric(10, 2) check (living_area_m2 > 0),
  heated_area_m2 numeric(10, 2) check (heated_area_m2 > 0),
  -- §7 para 1 sentence 2 HeizkostenV: exactly 70% consumption share.
  mandatory_70_pct boolean,
  -- Non-residential buildings are out of scope: no Statement Package is accepted.
  residential boolean not null,
  -- §9 CO2KostAufG reduction of the Property Manager's CO₂ share.
  co2_reduction text check (co2_reduction in ('none', 'heritage', 'district_heating')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buildings_organisation_id_idx on public.buildings (organisation_id);

alter table public.buildings enable row level security;

create policy "Members read their Organisation's buildings"
  on public.buildings for select to authenticated
  using (organisation_id = (select private.current_organisation_id()));

create policy "Members create buildings for their Organisation"
  on public.buildings for insert to authenticated
  with check (organisation_id = (select private.current_organisation_id()));

create policy "Members edit their Organisation's buildings"
  on public.buildings for update to authenticated
  using (organisation_id = (select private.current_organisation_id()))
  with check (organisation_id = (select private.current_organisation_id()));

-- Statement Packages and Check Reports (ticket 03) will hang off buildings and
-- are kept for 4 years, so buildings are not deleted from the app.
revoke delete on public.buildings from anon, authenticated;
revoke insert, update on public.buildings from anon;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;

create trigger buildings_touch_updated_at
  before update on public.buildings
  for each row execute function private.touch_updated_at();
