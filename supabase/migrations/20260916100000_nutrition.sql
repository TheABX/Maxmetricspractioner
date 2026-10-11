-- Nutrition profiles (prefs + computed targets) and daily plan/log entries.

create table if not exists public.nutrition_profiles (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  questionnaire_response_id uuid references public.questionnaire_responses (id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  goal text not null default 'maintain' check (goal in ('maintain', 'lean', 'bulk')),
  tdee_kcal integer,
  target_kcal integer,
  target_protein_g integer,
  target_carb_g integer,
  target_fat_g integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  entry_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  kind text not null check (kind in ('plan', 'log')),
  meal_slug text not null,
  servings numeric not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_entries_client_date_idx
  on public.nutrition_entries (client_id, entry_date, kind);

drop trigger if exists nutrition_profiles_updated_at on public.nutrition_profiles;
create trigger nutrition_profiles_updated_at before update on public.nutrition_profiles
  for each row execute function public.set_updated_at();

alter table public.nutrition_profiles enable row level security;
alter table public.nutrition_entries enable row level security;

grant select, insert, update, delete on public.nutrition_profiles to authenticated;
grant select, insert, update, delete on public.nutrition_entries to authenticated;

create policy nutrition_profiles_practitioner on public.nutrition_profiles
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy nutrition_profiles_client on public.nutrition_profiles
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

create policy nutrition_entries_practitioner on public.nutrition_entries
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

create policy nutrition_entries_client on public.nutrition_entries
  for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());
