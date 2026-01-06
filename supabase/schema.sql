-- Supabase schema for MADE planner persistence
-- How to apply:
-- 1) Supabase Dashboard -> SQL Editor
-- 2) Paste and run this file

-- 1) Table: one row per authenticated user (simple + reliable for this app)
create table if not exists public.planner_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tasks jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  updated_at timestamptz not null default now()
);

-- 2) Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planner_state_set_updated_at on public.planner_state;
create trigger planner_state_set_updated_at
before update on public.planner_state
for each row execute function public.set_updated_at();

-- 3) Row Level Security
alter table public.planner_state enable row level security;

drop policy if exists "planner_state_select_own" on public.planner_state;
create policy "planner_state_select_own"
on public.planner_state
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "planner_state_insert_own" on public.planner_state;
create policy "planner_state_insert_own"
on public.planner_state
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "planner_state_update_own" on public.planner_state;
create policy "planner_state_update_own"
on public.planner_state
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());



