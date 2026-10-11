-- Auth users existed without matching public.practitioners / public.clients rows
-- (paused project / empty public schema). Backfill so login and self-serve signup
-- have a clinic owner to attach new clients to.

insert into public.practitioners (id, full_name)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), '')
from auth.users u
where coalesce(u.raw_user_meta_data->>'role', 'practitioner') <> 'client'
on conflict (id) do nothing;

insert into public.clients (
  practitioner_id,
  first_name,
  last_name,
  email,
  auth_user_id,
  invited_at,
  portal_activated_at
)
select
  p.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'first_name'), ''), split_part(u.email, '@', 1), 'Client'),
  coalesce(nullif(trim(u.raw_user_meta_data->>'last_name'), ''), ''),
  lower(u.email),
  u.id,
  now(),
  now()
from auth.users u
cross join lateral (
  select id from public.practitioners order by created_at asc limit 1
) p
where coalesce(u.raw_user_meta_data->>'role', '') = 'client'
  and not exists (select 1 from public.clients c where c.auth_user_id = u.id);
