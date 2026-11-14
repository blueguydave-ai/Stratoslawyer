-- STRATOSLAWYER initial multi-user foundation
-- Run in Supabase SQL Editor. All monetary values are stored in kobo.
-- Provider secrets and privileged writes must remain server-side.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'lawyer' check (role in ('lawyer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual','paystack')),
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null default 'lawyer-monthly',
  amount_kobo bigint not null default 1500000 check (amount_kobo >= 0),
  status text not null default 'inactive' check (status in ('inactive','active','past_due','cancelled','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);

create table if not exists public.monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  allowance_kobo bigint not null default 600000 check (allowance_kobo >= 0),
  consumed_kobo bigint not null default 0 check (consumed_kobo >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, period_start),
  check (period_end >= period_start)
);

create table if not exists public.usage_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid,
  kind text not null check (kind in ('debit','credit','adjustment','refund')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists usage_transactions_user_date_idx on public.usage_transactions(user_id, created_at desc);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  matter_type text,
  jurisdiction text,
  status text not null default 'open' check (status in ('open','archived','closed')),
  description text,
  latest_analysis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_user_updated_idx on public.cases(user_id, updated_at desc);

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique(user_id, storage_path)
);

create index if not exists case_documents_case_idx on public.case_documents(case_id);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  provider text not null default 'google',
  model text not null,
  status text not null check (status in ('queued','running','succeeded','failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(14,8) not null default 0 check (cost_usd >= 0),
  cost_ngn_kobo bigint not null default 0 check (cost_ngn_kobo >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_requests_user_date_idx on public.ai_requests(user_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','success','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_date_idx on public.payments(user_id, created_at desc);

-- Create a profile automatically when a user registers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable row-level security on every user-facing table.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.monthly_usage enable row level security;
alter table public.usage_transactions enable row level security;
alter table public.cases enable row level security;
alter table public.case_documents enable row level security;
alter table public.ai_requests enable row level security;
alter table public.payments enable row level security;

-- Lawyers can read only their own profile and billing/usage information.
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "monthly_usage_read_own" on public.monthly_usage;
create policy "monthly_usage_read_own" on public.monthly_usage
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "usage_transactions_read_own" on public.usage_transactions;
create policy "usage_transactions_read_own" on public.usage_transactions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own" on public.cases
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own" on public.cases
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "cases_update_own" on public.cases;
create policy "cases_update_own" on public.cases
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "cases_delete_own" on public.cases;
create policy "cases_delete_own" on public.cases
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "documents_select_own" on public.case_documents;
create policy "documents_select_own" on public.case_documents
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "documents_insert_own" on public.case_documents;
create policy "documents_insert_own" on public.case_documents
  for insert to authenticated with check (
    user_id = (select auth.uid()) and
    exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid()))
  );
drop policy if exists "documents_delete_own" on public.case_documents;
create policy "documents_delete_own" on public.case_documents
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "ai_requests_read_own" on public.ai_requests;
create policy "ai_requests_read_own" on public.ai_requests
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "payments_read_own" on public.payments;
create policy "payments_read_own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- No client-side INSERT/UPDATE/DELETE policies are intentionally granted for
-- subscriptions, usage, AI request accounting or payments. Privileged server
-- functions using the service-role key will own these writes.
