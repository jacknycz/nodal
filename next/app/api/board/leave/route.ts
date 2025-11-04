import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const { boardId } = await req.json().catch(() => ({} as any))
    const userId = req.headers.get('x-user-id') || ''
    if (!boardId || !userId) {
      return NextResponse.json({ error: 'Missing boardId or userId' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()

    // Best-effort delete membership; ignore if nothing deleted
    const { error } = await supabase
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}


