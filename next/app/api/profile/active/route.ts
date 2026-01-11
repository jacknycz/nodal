import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const { userId } = await req.json() as { userId?: string }
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


