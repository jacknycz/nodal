import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

function normalizeUsername(u: string): string {
  return (u || '').trim().toLowerCase()
}

function isValidUsername(u: string): boolean {
  return /^[a-z0-9_\.]{3,24}$/.test(u)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = normalizeUsername(searchParams.get('username') || '')
  if (!username || !isValidUsername(username)) {
    return NextResponse.json({ available: false, reason: 'invalid' }, { status: 200 })
  }
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ available: !data })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const payload = await req.json()
    const { userId, username } = payload || {}
    const u = normalizeUsername(username || '')
    if (!userId || !u) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    if (!isValidUsername(u)) return NextResponse.json({ error: 'invalid username' }, { status: 400 })
    // Ensure uniqueness
    const { data: existing, error: selErr } = await supabase.from('profiles').select('id').ilike('username', u).maybeSingle()
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
    if (existing && existing.id !== userId) return NextResponse.json({ error: 'conflict' }, { status: 409 })
    // Fetch current profile to enforce 30-day cooldown if username already set
    let hasChangedAtCol = true
    let lastChangedAt: string | null = null
    let currentUsername: string | null = null
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('username, username_changed_at')
        .eq('id', userId)
        .maybeSingle()
      if (profErr) throw profErr
      currentUsername = (prof as any)?.username || null
      lastChangedAt = (prof as any)?.username_changed_at || null
    } catch (e: any) {
      // Column may not exist yet — proceed without cooldown enforcement
      const msg: string = e?.message || ''
      if (msg.includes('username_changed_at') || msg.includes('column')) {
        hasChangedAtCol = false
      } else {
        // Other errors: ignore cooldown but allow change
        hasChangedAtCol = false
      }
    }

    if (hasChangedAtCol && currentUsername && u !== currentUsername) {
      if (lastChangedAt) {
        const last = new Date(lastChangedAt)
        const now = new Date()
        const diffMs = now.getTime() - last.getTime()
        const days = diffMs / (1000 * 60 * 60 * 24)
        const minDays = 30
        if (days < minDays) {
          const retryAt = new Date(last.getTime() + minDays * 24 * 60 * 60 * 1000)
          return NextResponse.json({ error: 'cooldown', retryAt: retryAt.toISOString() }, { status: 429 })
        }
      }
    }

    // Upsert profile row with new username (and changed_at if supported)
    const payloadUpdate: any = { id: userId, username: u }
    if (hasChangedAtCol) payloadUpdate.username_changed_at = new Date().toISOString()
    const { error: upErr } = await supabase.from('profiles').upsert(payloadUpdate, { onConflict: 'id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, username: u })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 })
  }
}


