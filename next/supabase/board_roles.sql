-- Board roles and membership
create type if not exists public.board_role as enum ('owner', 'editor', 'viewer');

-- Members table maps users to boards with a role
create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.board_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- Invitation role support
alter table if exists public.board_invitations
  add column if not exists role public.board_role not null default 'editor';

-- Triggers to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_board_members_touch on public.board_members;
create trigger trg_board_members_touch
before update on public.board_members
for each row execute procedure public.touch_updated_at();

-- RLS Policies
alter table public.board_members enable row level security;

-- Owners (boards.user_id) can manage all memberships of their boards
create policy if not exists board_members_owner_manage
on public.board_members
for all
to authenticated
using (exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid()));

-- Members can view their own membership rows
create policy if not exists board_members_self_select
on public.board_members
for select
to authenticated
using (auth.uid() = user_id);


