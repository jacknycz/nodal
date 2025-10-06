import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'

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
    // Upsert profile row with new username
    const { error: upErr } = await supabase.from('profiles').upsert({ id: userId, username: u }, { onConflict: 'id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, username: u })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 })
  }
}


