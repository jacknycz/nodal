import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const { boardId, isPublic } = await req.json()
    if (!boardId || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'Missing boardId or isPublic' }, { status: 400 })
    }
    const supabase = getSupabaseServiceClient()

    // Require an authenticated user and ensure they own the board before toggling visibility.
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: u, error: uErr } = await supabase.auth.getUser(token)
    const userId = u?.user?.id || null
    if (uErr || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: boardRow, error: bErr } = await supabase
      .from('boards')
      .select('user_id')
      .eq('id', boardId)
      .maybeSingle()
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    const ownerId = (boardRow as any)?.user_id as string | undefined
    if (!ownerId || ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('boards')
      .update({ is_public: isPublic, last_modified: Date.now() })
      .eq('id', boardId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update public flag' }, { status: 500 })
  }
}


