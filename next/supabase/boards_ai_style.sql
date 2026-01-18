-- Adds a dedicated, long-lived AI behavior style to boards.
-- This is intentionally NOT stored inside boards.data (JSONB) to keep payloads lean and schema explicit.

alter table public.boards
  add column if not exists ai_style text not null default 'balanced';

comment on column public.boards.ai_style is
  'Per-board AI behavior style: balanced | precise | creative | critical. Stored as a dedicated column (not JSONB) for long-term stability.';

