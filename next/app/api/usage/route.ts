import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    // Identify user
    let userId: string | null = null
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const { data } = await supabase.auth.getUser(token)
        userId = data.user?.id || null
      }
    } catch {}
    if (!userId) {
      const hdr = req.headers.get('x-user-id')
      if (hdr) userId = hdr
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Current month range
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const { data, error } = await supabase
      .from('ai_usage')
      .select('tokens_used, created_at, model')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = (data || []).reduce((s: number, r: any) => s + Number(r.tokens_used || 0), 0)

    // Map role->token cap (Free 15k, Pro 100k, Admin unlimited)
    let cap = 15000
    try {
      const prof = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      const role = (prof.data as any)?.role || 'User'
      if (String(role).toLowerCase() === 'pro') cap = 100000
      if (String(role).toLowerCase() === 'admin') cap = Number.MAX_SAFE_INTEGER
    } catch {}

    const remaining = Math.max(0, cap - total)
    const pct = cap === Number.MAX_SAFE_INTEGER ? 0 : (total / cap)

    return NextResponse.json({ total, cap, remaining, pct, records: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch usage' }, { status: 500 })
  }
}


