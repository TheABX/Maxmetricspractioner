-- Self-serve client signup: a new auth user with role=client gets a clients row
-- stored in Supabase even when no practitioner invited them first.
-- Intake fields stay optional until the questionnaire / clinic desk fills them in.

alter table public.clients
  alter column last_name drop not null,
  alter column dob drop not null,
  alter column sex drop not null,
  alter column height_cm drop not null,
  alter column bodyweight_kg drop not null;

alter table public.clients
  alter column last_name set default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  local_name text;
begin
  if coalesce(new.raw_user_meta_data->>'role', 'practitioner') <> 'client' then
    insert into public.practitioners (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
    on conflict (id) do nothing;
    return new;
  end if;

  update public.clients
     set auth_user_id = new.id, portal_activated_at = coalesce(portal_activated_at, now())
   where lower(coalesce(email, '')) = lower(coalesce(new.email, ''))
     and auth_user_id is null;
  if found then
    return new;
  end if;

  if exists (select 1 from public.clients where auth_user_id = new.id) then
    return new;
  end if;

  select id into owner from public.practitioners order by created_at asc limit 1;
  if owner is null or new.email is null then
    return new;
  end if;

  local_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Client'
  );

  insert into public.clients (
    practitioner_id,
    first_name,
    last_name,
    email,
    auth_user_id,
    invited_at,
    portal_activated_at
  ) values (
    owner,
    local_name,
    coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), ''),
    lower(new.email),
    new.id,
    now(),
    now()
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

create or replace function public.claim_client_profile()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  first_name text;
  last_name text;
  owner uuid;
  cid uuid;
begin
  if uid is null then return null; end if;

  select id into cid from public.clients where auth_user_id = uid limit 1;
  if cid is not null then return cid; end if;

  select
    lower(u.email),
    coalesce(nullif(trim(u.raw_user_meta_data->>'first_name'), ''), nullif(split_part(u.email, '@', 1), ''), 'Client'),
    coalesce(nullif(trim(u.raw_user_meta_data->>'last_name'), ''), '')
  into user_email, first_name, last_name
  from auth.users u
  where u.id = uid;
  if user_email is null then return null; end if;

  update public.clients
     set auth_user_id = uid, portal_activated_at = coalesce(portal_activated_at, now())
   where lower(coalesce(email, '')) = user_email and auth_user_id is null
   returning id into cid;
  if cid is not null then return cid; end if;

  select id into owner from public.practitioners order by created_at asc limit 1;
  if owner is null then return null; end if;

  insert into public.clients (
    practitioner_id,
    first_name,
    last_name,
    email,
    auth_user_id,
    invited_at,
    portal_activated_at
  ) values (
    owner,
    first_name,
    last_name,
    user_email,
    uid,
    now(),
    now()
  )
  returning id into cid;

  return cid;
end;
$$;

revoke all on function public.claim_client_profile() from public;
revoke execute on function public.claim_client_profile() from anon, public;
grant execute on function public.claim_client_profile() to authenticated;
