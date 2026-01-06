-- Supabase schema for login-less sync (anonymous) using a secret write key.
--
-- How it works:
-- - Client generates (sync_key UUID, write_key string) and stores them in URL hash (#sync=...&k=...)
-- - All reads/writes go through SECURITY DEFINER RPC functions that verify the write_key
-- - No Supabase Auth required
--
-- Apply:
-- 1) Supabase Dashboard -> SQL Editor
-- 2) Run this file

-- Needed for crypt() / gen_salt()
create extension if not exists pgcrypto;

-- Allow anon role to resolve objects in public schema (required for RPC discoverability)
grant usage on schema public to anon;

-- Keep updated_at fresh (self-contained; no dependency on other schema files)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.planner_public_state (
  sync_key uuid primary key,
  write_key_hash text not null,
  tasks jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
drop trigger if exists planner_public_state_set_updated_at on public.planner_public_state;
create trigger planner_public_state_set_updated_at
before update on public.planner_public_state
for each row execute function public.set_updated_at();

-- Lock down table (force access via RPC)
alter table public.planner_public_state enable row level security;
drop policy if exists "planner_public_state_deny_all" on public.planner_public_state;
create policy "planner_public_state_deny_all"
on public.planner_public_state
for all
to public
using (false)
with check (false);

-- RPC: get state (requires write key)
create or replace function public.get_planner_public_state(p_sync_key uuid, p_write_key text)
returns table (tasks jsonb, config jsonb, schema_version int, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select s.tasks, s.config, s.schema_version, s.updated_at
  from public.planner_public_state s
  where s.sync_key = p_sync_key
    and crypt(p_write_key, s.write_key_hash) = s.write_key_hash;
end;
$$;

-- RPC: upsert state (creates row if missing, else verifies write key)
create or replace function public.upsert_planner_public_state(
  p_sync_key uuid,
  p_write_key text,
  p_tasks jsonb,
  p_config jsonb,
  p_schema_version int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_hash text;
begin
  select write_key_hash into v_existing_hash
  from public.planner_public_state
  where sync_key = p_sync_key;

  if v_existing_hash is null then
    insert into public.planner_public_state (sync_key, write_key_hash, tasks, config, schema_version)
    values (p_sync_key, crypt(p_write_key, gen_salt('bf')), coalesce(p_tasks, '[]'::jsonb), coalesce(p_config, '{}'::jsonb), coalesce(p_schema_version, 1));
  else
    if crypt(p_write_key, v_existing_hash) <> v_existing_hash then
      raise exception 'Invalid write key';
    end if;

    update public.planner_public_state
    set tasks = coalesce(p_tasks, tasks),
        config = coalesce(p_config, config),
        schema_version = coalesce(p_schema_version, schema_version)
    where sync_key = p_sync_key;
  end if;
end;
$$;

-- Allow anon clients to call the RPCs
grant execute on function public.get_planner_public_state(uuid, text) to anon;
grant execute on function public.upsert_planner_public_state(uuid, text, jsonb, jsonb, int) to anon;


