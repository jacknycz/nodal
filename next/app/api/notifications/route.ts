import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const supabase = getSupabaseServiceClient()
    // Cleanup: delete read notifications older than 30 days
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .lt('read_at', cutoff)
    } catch {}

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return NextResponse.json({ notifications: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load notifications' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId, ids, markAll } = body || {}
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const now = new Date().toISOString()
    if (markAll) {
      await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
      return NextResponse.json({ ok: true })
    }
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })
    await supabase.from('notifications').update({ read_at: now }).in('id', ids)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update notifications' }, { status: 500 })
  }
}


