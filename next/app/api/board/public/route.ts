import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const { boardId, isPublic } = await req.json()
    if (!boardId || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'Missing boardId or isPublic' }, { status: 400 })
    }
    const supabase = getSupabaseServiceClient()
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


