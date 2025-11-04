import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
// Prefer service role (server-side) to bypass RLS for shared lookup, scoped by invite list
const supabase = createClient(supabaseUrl, service || anon)

// GET /api/board/shared?email=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const userId = searchParams.get('userId')
  console.log('[shared API] email:', email)
  if (!email && !userId) {
    return NextResponse.json({ error: 'Missing email or userId' }, { status: 400 })
  }
  // 1. Collect board ids from accepted invitations (by email, case-insensitive) and from board_members (by userId)
  let boardIds: string[] = []
  try {
    if (email) {
      const { data: invites, error: inviteError } = await supabase
        .from('board_invitations')
        .select('*')
        .ilike('email', email)
        .eq('status', 'accepted')
      console.log('[shared API] invites:', invites)
      if (inviteError) throw inviteError
      boardIds = [...boardIds, ...((invites || []).map((i: any) => i.board_id))]
    }
  } catch (err) {
    console.log('[shared API] inviteError:', err)
  }
  try {
    if (userId) {
      const { data: memberRows, error: memberError } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('user_id', userId)
      if (memberError) throw memberError
      boardIds = [...boardIds, ...((memberRows || []).map((m: any) => m.board_id))]
    }
  } catch (err) {
    console.log('[shared API] memberError:', err)
  }
  boardIds = Array.from(new Set(boardIds.filter(Boolean)))
  if (boardIds.length === 0) {
    return NextResponse.json({ boards: [] })
  }
  // 2. Fetch boards for these board_ids
  console.log('[shared API] boardIds:', boardIds)
  const { data: boards, error: boardError } = await supabase
    .from('boards')
    .select('id, name, user_id, created_at, last_modified, node_count, edge_count, data')
    .in('id', boardIds)
  console.log('[shared API] boards:', boards)
  if (boardError) {
    console.log('[shared API] boardError:', boardError)
    return NextResponse.json({ error: boardError.message }, { status: 500 })
  }
  // 3. Attach inviter info to each board
  const boardsWithInviter = (boards || []).map(board => {
    const isOwnedByUser = userId ? (board.user_id === userId) : false
    return {
      // Normalize to client SavedBoard shape where possible
      id: board.id,
      name: board.name,
      userId: board.user_id,
      createdAt: board.created_at,
      lastModified: board.last_modified || board.created_at,
      nodeCount: board.node_count ?? 0,
      edgeCount: board.edge_count ?? 0,
      data: board.data || {},
      shared: !isOwnedByUser,
      invited_by: null,
      invitation_id: null,
    }
  })
  console.log('[shared API] boardsWithInviter:', boardsWithInviter)
  return NextResponse.json({ boards: boardsWithInviter })
}
