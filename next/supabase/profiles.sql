-- Enable citext extension (case-insensitive text)
create extension if not exists citext;

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Case-insensitive unique on username (redundant if citext unique is supported, kept for safety)
create unique index if not exists profiles_username_lower_key on public.profiles ((lower(username)));

-- Constraint: username format 3-24 of [a-z0-9_.]
alter table public.profiles
  add constraint profiles_username_format_chk
  check (
    username is null or username ~ '^[a-z0-9_\.]{3,24}$'
  );

-- RLS
alter table public.profiles enable row level security;

do $$ begin
  create policy profiles_select on public.profiles for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_insert on public.profiles for insert
    with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy profiles_update on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Optional: handle new auth user (can also be application-side upsert)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, null, null, null)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Billing and role override columns used by app logic
alter table if exists public.profiles
  add column if not exists role_override text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_item_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;


