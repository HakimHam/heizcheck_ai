-- Organisations and their members. Every user belongs to exactly one
-- Organisation, and all members have equal rights: there are no roles.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- user_id is the primary key, so a user can be a member of one Organisation only.
create table public.organisation_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index organisation_members_organisation_id_idx
  on public.organisation_members (organisation_id);

-- Signing up creates the user's Organisation, named in the sign-up metadata,
-- in the same transaction as the user, so no user is ever without one.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organisation_id uuid;
begin
  insert into public.organisations (name)
  values (trim(new.raw_user_meta_data ->> 'organisation_name'))
  returning id into new_organisation_id;

  insert into public.organisation_members (user_id, organisation_id)
  values (new.id, new_organisation_id);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security: a user sees their own Organisation and its members,
-- nothing else. Memberships are only ever written by the sign-up trigger
-- (and, later, by invitations), never directly by a client.

-- The signed-in user's Organisation. Security definer so policies can look up
-- the membership without recursing into organisation_members' own policy.
create function public.current_organisation_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organisation_id from public.organisation_members where user_id = auth.uid()
$$;

revoke execute on function public.current_organisation_id() from public, anon;
grant execute on function public.current_organisation_id() to authenticated;

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

create policy "Members can read their Organisation"
  on public.organisations for select
  to authenticated
  using (id = public.current_organisation_id());

create policy "Members can read their Organisation's members"
  on public.organisation_members for select
  to authenticated
  using (organisation_id = public.current_organisation_id());
