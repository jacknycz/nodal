-- AI Usage tracking table and policies

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid null references public.boards(id) on delete set null,
  model text null,
  tokens_used integer not null check (tokens_used >= 0),
  created_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

-- Users can insert their own usage rows
create policy if not exists ai_usage_insert_self
  on public.ai_usage for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can select only their own rows
create policy if not exists ai_usage_select_self
  on public.ai_usage for select
  to authenticated
  using (user_id = auth.uid());

-- Optional: Admins can select all (assumes is_admin() function exists)
-- create policy ai_usage_admin_all on public.ai_usage for all to authenticated using (is_admin());

-- Daily aggregate view (optional helper)
create materialized view if not exists public.ai_usage_daily as
select
  user_id,
  date_trunc('day', created_at) as day,
  sum(tokens_used) as tokens
from public.ai_usage
group by 1,2;

-- Refresh helper
create or replace function public.refresh_ai_usage_daily()
returns void language sql security definer as $$
  refresh materialized view public.ai_usage_daily;
$$;


