-- Favourite meals a client can tap again, plus allow favourite-sourced logs.

alter table public.nutrition_entries drop constraint if exists nutrition_entries_source_check;
alter table public.nutrition_entries
  add constraint nutrition_entries_source_check
  check (source in ('library', 'photo', 'favorite'));

create table if not exists public.nutrition_favorites (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  source text not null check (source in ('library', 'photo', 'favorite')),
  meal_slug text not null default 'photo',
  custom_name text,
  kcal numeric,
  protein_g numeric,
  carb_g numeric,
  fat_g numeric,
  photo_path text,
  estimate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists nutrition_favorites_library_uidx
  on public.nutrition_favorites (client_id, slot, meal_slug)
  where source = 'library';

create unique index if not exists nutrition_favorites_named_uidx
  on public.nutrition_favorites (client_id, slot, lower(btrim(custom_name)))
  where source <> 'library' and custom_name is not null;

create index if not exists nutrition_favorites_client_slot_idx
  on public.nutrition_favorites (client_id, slot, created_at desc);

alter table public.nutrition_favorites enable row level security;

grant select, insert, update, delete on public.nutrition_favorites to authenticated;

create policy nutrition_favorites_practitioner on public.nutrition_favorites
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy nutrition_favorites_client on public.nutrition_favorites
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());
