import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// GET /api/board/shared?email=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  console.log('[shared API] email:', email)
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }
  // 1. Get accepted invitations for this email
  const { data: invites, error: inviteError } = await supabase
    .from('board_invitations')
    .select('*')
    .eq('email', email)
    .eq('status', 'accepted')
  console.log('[shared API] invites:', invites)
  if (inviteError) {
    console.log('[shared API] inviteError:', inviteError)
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }
  if (!invites || invites.length === 0) {
    console.log('[shared API] No invites found')
    return NextResponse.json({ boards: [] })
  }
  // 2. Fetch boards for these board_ids
  const boardIds = invites.map(invite => invite.board_id)
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
  const boardsWithInviter = boards.map(board => {
    const invite = invites.find(i => i.board_id === board.id)
    return {
      ...board,
      shared: true,
      invited_by: invite?.invited_by || invite?.user_id, // fallback to user_id if needed
      invitation_id: invite?.id
    }
  })
  console.log('[shared API] boardsWithInviter:', boardsWithInviter)
  return NextResponse.json({ boards: boardsWithInviter })
}
