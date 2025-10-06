-- Notifications table and policies
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

-- RLS: users can see their own notifications
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'select_own_notifications'
  ) then
    create policy select_own_notifications on public.notifications
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- RLS: allow user to update read_at for own notifications
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'update_own_notifications'
  ) then
    create policy update_own_notifications on public.notifications
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;


