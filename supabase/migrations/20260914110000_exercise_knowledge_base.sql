-- Layer 4: tagged exercise knowledge base + per-client selection snapshot.
-- Catalog rows keep practitioner_id null. Practitioners may edit them.

alter table public.exercises add column if not exists slug text;
alter table public.exercises add column if not exists display_name text;
alter table public.exercises add column if not exists description text;
alter table public.exercises add column if not exists category text;
alter table public.exercises add column if not exists movement_pattern text;
alter table public.exercises add column if not exists kb jsonb not null default '{}'::jsonb;

create unique index if not exists exercises_slug_key on public.exercises (slug) where slug is not null;

create table if not exists public.exercise_relationships (
  id uuid primary key default gen_random_uuid(),
  from_exercise_id uuid not null references public.exercises (id) on delete cascade,
  to_exercise_id uuid not null references public.exercises (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('REGRESSION', 'PROGRESSION', 'ALTERNATIVE')),
  unique (from_exercise_id, to_exercise_id, relationship_type)
);

create table if not exists public.exercise_history (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  first_prescribed timestamptz,
  last_prescribed timestamptz,
  sessions_completed integer not null default 0,
  average_rpe numeric,
  pain_reports integer not null default 0,
  client_rating numeric,
  practitioner_notes text,
  unique (client_id, exercise_id)
);

create table if not exists public.program_selections (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb,
  selection jsonb not null default '{}'::jsonb,
  rationale jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists program_selections_updated_at on public.program_selections;
create trigger program_selections_updated_at before update on public.program_selections
  for each row execute function public.set_updated_at();

alter table public.exercise_relationships enable row level security;
alter table public.exercise_history enable row level security;
alter table public.program_selections enable row level security;

grant select, insert, update, delete on public.exercise_relationships to authenticated;
grant select, insert, update, delete on public.exercise_history to authenticated;
grant select, insert, update, delete on public.program_selections to authenticated;

drop policy if exists exercise_relationships_read on public.exercise_relationships;
create policy exercise_relationships_read on public.exercise_relationships
  for select to authenticated using (true);

drop policy if exists exercise_relationships_write on public.exercise_relationships;
create policy exercise_relationships_write on public.exercise_relationships
  for all to authenticated
  using (exists (select 1 from public.practitioners p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.practitioners p where p.id = (select auth.uid())));

drop policy if exists exercise_history_practitioner on public.exercise_history;
create policy exercise_history_practitioner on public.exercise_history
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

drop policy if exists program_selections_practitioner on public.program_selections;
create policy program_selections_practitioner on public.program_selections
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);

-- Shared catalog (practitioner_id is null) is editable by practitioners.
drop policy if exists exercises_catalog_update on public.exercises;
create policy exercises_catalog_update on public.exercises
  for update to authenticated
  using (practitioner_id is null and exists (select 1 from public.practitioners p where p.id = (select auth.uid())))
  with check (practitioner_id is null);

drop policy if exists exercises_catalog_insert on public.exercises;
create policy exercises_catalog_insert on public.exercises
  for insert to authenticated
  with check (practitioner_id is null and exists (select 1 from public.practitioners p where p.id = (select auth.uid())));
