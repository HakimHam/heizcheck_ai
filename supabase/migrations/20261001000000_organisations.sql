-- Organisations and their members. Every user belongs to exactly one
-- Organisation, and all members have equal rights (no roles).

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index organisation_members_organisation_id_idx
  on public.organisation_members (organisation_id);

-- Not exposed through the Supabase Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- The signed-in user's Organisation. Security definer so RLS policies can call
-- it without recursing into organisation_members' own policy.
create function private.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organisation_id from public.organisation_members where user_id = auth.uid()
$$;

revoke all on function private.current_organisation_id() from public;
grant execute on function private.current_organisation_id() to authenticated;

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

create policy "Members read their Organisation"
  on public.organisations for select to authenticated
  using (id = (select private.current_organisation_id()));

create policy "Members see their colleagues"
  on public.organisation_members for select to authenticated
  using (organisation_id = (select private.current_organisation_id()));

-- Organisations and memberships are created by the sign-up trigger below, and
-- later by invitations; clients never write them directly.
revoke insert, update, delete on public.organisations from anon, authenticated;
revoke insert, update, delete on public.organisation_members from anon, authenticated;

-- Sign-up creates the user's Organisation from the name given at sign-up.
-- Invitations (ticket 15) also insert into auth.users and must add the invitee
-- to the inviting Organisation instead.
create function private.create_organisation_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organisation_id uuid;
begin
  insert into public.organisations (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'organisation_name'), ''), new.email))
  returning id into new_organisation_id;

  insert into public.organisation_members (user_id, organisation_id)
  values (new.id, new_organisation_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_organisation_for_new_user();
