-- Buildings belong to one Organisation. The Building Profile fields arrive
-- with ticket 02; this is the table every Organisation-owned row hangs off.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_organisation_id()
    references public.organisations (id) on delete cascade,
  address text not null check (length(trim(address)) > 0),
  created_at timestamptz not null default now()
);

create index buildings_organisation_id_idx on public.buildings (organisation_id);

alter table public.buildings enable row level security;

-- All members have equal rights, so one policy covers every operation.
-- `with check` stops rows being written into, or moved to, another Organisation.
create policy "Members manage their Organisation's buildings"
  on public.buildings for all
  to authenticated
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());
