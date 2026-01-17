-- Phase A (board data hygiene / performance)
-- JSONB patch helper to avoid fetching + rewriting huge boards.data blobs for small updates.
--
-- Deploy during maintenance (Supabase SQL editor / migrations):
--   - Creates a small RPC: patch_board_data(board_id, patch, node_count?, edge_count?)
--   - Respects RLS because it's SECURITY INVOKER by default.

create or replace function public.patch_board_data(
  p_board_id uuid,
  p_patch jsonb,
  p_node_count integer default null,
  p_edge_count integer default null
)
returns void
language sql
as $$
  update public.boards
  set
    data = coalesce(data, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb),
    last_modified = (extract(epoch from now()) * 1000)::bigint,
    node_count = coalesce(p_node_count, node_count),
    edge_count = coalesce(p_edge_count, edge_count)
  where id = p_board_id;
$$;

-- Allow authenticated clients to call it (RLS still applies to the underlying update).
grant execute on function public.patch_board_data(uuid, jsonb, integer, integer) to authenticated;

