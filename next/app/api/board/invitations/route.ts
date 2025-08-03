import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// POST: Send invitation { boardId, email }
// GET: Fetch invitations for current user (by email)

export async function POST(req: NextRequest) {
  const { boardId, email, invitedBy } = await req.json()
  if (!boardId || !email || !invitedBy) {
    return NextResponse.json({ error: 'Missing boardId, email, or invitedBy' }, { status: 400 })
  }
  const { data, error } = await supabase.from('board_invitations').insert([
    { board_id: boardId, email, invited_by: invitedBy }
  ])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}

export async function GET(req: NextRequest) {
  // Get user email from query param (for now, since we don't have SSR session)
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('board_invitations')
    .select('*')
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ invitations: data })
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('board_invitations')
    .update({ status })
    .eq('id', id)
    .select()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}
