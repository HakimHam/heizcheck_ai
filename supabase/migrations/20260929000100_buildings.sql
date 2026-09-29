-- Buildings belong to one Organisation. The Building Profile columns follow in ticket 02.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default private.current_organisation_id()
    references public.organisations (id) on delete cascade,
  address text not null check (length(trim(address)) > 0),
  created_at timestamptz not null default now()
);

create index buildings_organisation_id_idx on public.buildings (organisation_id);

alter table public.buildings enable row level security;

create policy "Members can read their Organisation's buildings"
  on public.buildings for select to authenticated
  using (organisation_id = private.current_organisation_id());

create policy "Members can add buildings to their Organisation"
  on public.buildings for insert to authenticated
  with check (organisation_id = private.current_organisation_id());

create policy "Members can edit their Organisation's buildings"
  on public.buildings for update to authenticated
  using (organisation_id = private.current_organisation_id())
  with check (organisation_id = private.current_organisation_id());

create policy "Members can delete their Organisation's buildings"
  on public.buildings for delete to authenticated
  using (organisation_id = private.current_organisation_id());

revoke all on public.buildings from anon, authenticated;
grant select, insert, update, delete on public.buildings to authenticated;
