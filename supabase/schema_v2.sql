-- MADE Planner - Simple DB Schema (v2)
-- 
-- 설계 원칙:
-- 1. 테이블 1개, RPC 없음, RLS 최소화
-- 2. recovery_code 하나로 식별 (로그인 없음)
-- 3. anon이 직접 CRUD (단순함 우선)
--
-- 실행: Supabase Dashboard → SQL Editor → 이 파일 전체 실행

-- 기존 v1 오브젝트 정리 (있으면 삭제)
drop function if exists public.get_planner_public_state(uuid, text);
drop function if exists public.upsert_planner_public_state(uuid, text, jsonb, jsonb, int);
drop table if exists public.planner_public_state;
drop table if exists public.planner_state;

-- 새 테이블
create table public.planner_data (
  recovery_code text primary key,
  tasks jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger planner_data_updated_at
before update on public.planner_data
for each row execute function public.set_updated_at();

-- RLS: anon이 모든 행에 CRUD 가능 (recovery_code가 비밀키 역할)
alter table public.planner_data enable row level security;

create policy "anon_full_access"
on public.planner_data
for all
to anon
using (true)
with check (true);

-- anon 권한 부여
grant usage on schema public to anon;
grant all on public.planner_data to anon;

