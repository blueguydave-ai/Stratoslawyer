-- Daily analysis allowance: 10 successful analyses per user per Nigeria calendar day.
-- Run this migration in the Supabase SQL Editor before deploying the matching app code.

create table if not exists public.daily_analysis_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  analyses_used integer not null default 0 check (analyses_used between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.daily_analysis_usage enable row level security;

drop policy if exists "daily_analysis_usage_read_own" on public.daily_analysis_usage;
create policy "daily_analysis_usage_read_own" on public.daily_analysis_usage
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.get_daily_analysis_usage(p_user_id uuid)
returns table (
  analyses_used integer,
  analyses_remaining integer,
  daily_limit integer,
  usage_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := (now() at time zone 'Africa/Lagos')::date;
  v_used integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorised';
  end if;

  select coalesce(u.analyses_used, 0)
    into v_used
    from public.daily_analysis_usage u
    where u.user_id = p_user_id and u.usage_date = v_date;

  return query select v_used, greatest(10 - v_used, 0), 10, v_date;
end;
$$;

create or replace function public.reserve_daily_analysis(p_user_id uuid)
returns table (
  allowed boolean,
  analyses_used integer,
  analyses_remaining integer,
  daily_limit integer,
  usage_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := (now() at time zone 'Africa/Lagos')::date;
  v_used integer := null;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorised';
  end if;

  insert into public.daily_analysis_usage as usage (user_id, usage_date, analyses_used, updated_at)
  values (p_user_id, v_date, 1, now())
  on conflict (user_id, usage_date) do update
    set analyses_used = usage.analyses_used + 1,
        updated_at = now()
    where usage.analyses_used < 10
  returning usage.analyses_used into v_used;

  if v_used is null then
    select u.analyses_used into v_used
      from public.daily_analysis_usage u
      where u.user_id = p_user_id and u.usage_date = v_date;
    return query select false, coalesce(v_used, 10), 0, 10, v_date;
  else
    return query select true, v_used, greatest(10 - v_used, 0), 10, v_date;
  end if;
end;
$$;

create or replace function public.release_daily_analysis(p_user_id uuid, p_usage_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorised';
  end if;

  update public.daily_analysis_usage
    set analyses_used = greatest(analyses_used - 1, 0),
        updated_at = now()
    where user_id = p_user_id and usage_date = p_usage_date;

  return found;
end;
$$;

revoke all on function public.get_daily_analysis_usage(uuid) from public;
revoke all on function public.reserve_daily_analysis(uuid) from public;
revoke all on function public.release_daily_analysis(uuid, date) from public;
grant execute on function public.get_daily_analysis_usage(uuid) to authenticated;
grant execute on function public.reserve_daily_analysis(uuid) to authenticated;
grant execute on function public.release_daily_analysis(uuid, date) to authenticated;
