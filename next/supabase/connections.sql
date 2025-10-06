-- Connections table and policies
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted','declined','blocked')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connections_requester_idx on public.connections (requester_id);
create index if not exists connections_addressee_idx on public.connections (addressee_id);

-- Ensure at most one row per unordered pair
create unique index if not exists connections_unique_pair_idx
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

alter table public.connections enable row level security;

-- RLS: requester or addressee can select
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'select_own_connections'
  ) then
    create policy select_own_connections on public.connections
      for select using (auth.uid() in (requester_id, addressee_id));
  end if;
end $$;

-- RLS: requester can insert pending requests (no self-connection)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'insert_pending_requests'
  ) then
    create policy insert_pending_requests on public.connections
      for insert with check (
        requester_id = auth.uid() and addressee_id <> auth.uid() and status = 'pending'
      );
  end if;
end $$;

-- RLS: addressee can update status; either party can set accepted/declined/blocked on their pair
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'connections' and policyname = 'update_connection_status'
  ) then
    create policy update_connection_status on public.connections
      for update using (auth.uid() in (requester_id, addressee_id)) with check (auth.uid() in (requester_id, addressee_id));
  end if;
end $$;

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists set_connections_updated_at on public.connections;
create trigger set_connections_updated_at before update on public.connections
for each row execute function public.set_updated_at();


