-- Organisations and their members.
-- Every user belongs to exactly one Organisation; all members have equal rights (no roles).

create schema private;

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- user_id is the primary key, so a user can belong to one Organisation only.
create table public.organisation_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index organisation_members_organisation_id_idx
  on public.organisation_members (organisation_id);

-- The signed-in user's Organisation. Security definer so policies can call it
-- without recursing into organisation_members' own RLS.
create function private.current_organisation_id() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organisation_id from public.organisation_members where user_id = auth.uid()
$$;

-- Postgres grants EXECUTE to PUBLIC by default; keep the security definer surface explicit.
revoke execute on function private.current_organisation_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_organisation_id() to authenticated;

-- On sign-up, create the user's Organisation from the sign-up metadata.
create function private.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  new_organisation_id uuid;
begin
  insert into public.organisations (name)
  values (new.raw_user_meta_data ->> 'organisation_name')
  returning id into new_organisation_id;

  insert into public.organisation_members (user_id, organisation_id)
  values (new.id, new_organisation_id);

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

create policy "Members can read their Organisation"
  on public.organisations for select to authenticated
  using (id = private.current_organisation_id());

create policy "Members can read their Organisation's members"
  on public.organisation_members for select to authenticated
  using (organisation_id = private.current_organisation_id());

revoke all on public.organisations, public.organisation_members from anon, authenticated;
grant select on public.organisations, public.organisation_members to authenticated;
