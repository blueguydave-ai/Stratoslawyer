-- Secure cross-device saved analyses, intake snapshots and case deadlines.
-- Run in Supabase SQL Editor before deploying the matching application code.

create table if not exists public.saved_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Case analysis' check (char_length(title) between 1 and 160),
  markdown text not null,
  intake_snapshot jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  deadlines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(deadlines) = 'array'),
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_analyses_user_saved_idx
  on public.saved_analyses(user_id, saved_at desc);
create index if not exists saved_analyses_user_favorite_idx
  on public.saved_analyses(user_id, is_favorite);

alter table public.saved_analyses enable row level security;

drop policy if exists "saved_analyses_select_own" on public.saved_analyses;
create policy "saved_analyses_select_own" on public.saved_analyses
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "saved_analyses_insert_own" on public.saved_analyses;
create policy "saved_analyses_insert_own" on public.saved_analyses
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "saved_analyses_update_own" on public.saved_analyses;
create policy "saved_analyses_update_own" on public.saved_analyses
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "saved_analyses_delete_own" on public.saved_analyses;
create policy "saved_analyses_delete_own" on public.saved_analyses
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.saved_analyses to authenticated;
