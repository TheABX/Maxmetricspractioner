-- Layer 5: per-client prescription / dosage snapshot.
-- Stores automatic dose, practitioner overrides, and the effective result.

create table if not exists public.program_dosages (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  client_id uuid not null unique references public.clients (id) on delete cascade,
  auto jsonb not null default '{}'::jsonb,
  overrides jsonb,
  dosage jsonb not null default '{}'::jsonb,
  rationale jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists program_dosages_updated_at on public.program_dosages;
create trigger program_dosages_updated_at before update on public.program_dosages
  for each row execute function public.set_updated_at();

alter table public.program_dosages enable row level security;

grant select, insert, update, delete on public.program_dosages to authenticated;

drop policy if exists program_dosages_practitioner on public.program_dosages;
create policy program_dosages_practitioner on public.program_dosages
  for all to authenticated
  using ((select auth.uid()) = practitioner_id)
  with check ((select auth.uid()) = practitioner_id);
