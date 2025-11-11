import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAdminMeta(role: any): boolean {
  return typeof role === 'string' && /^admin$/i.test(role)
}

function isEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const DEFAULTS = ['jack.nycz@gmail.com']
  const fromEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  const set = new Set<string>([...DEFAULTS, ...fromEnv])
  return set.has(String(email).toLowerCase())
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user: me } } = await supabase.auth.getUser(token)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const myRole = (me.app_metadata as any)?.role
    if (!(isAdminMeta(myRole) || isEmailAdmin(me.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, override } = body || {}
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    // override: 'Admin' | 'Pro' | 'User' | null
    let value: string | null = null
    if (typeof override === 'string' && /^(admin|pro|user)$/i.test(override)) {
      value = /^admin$/i.test(override) ? 'Admin' : /^pro$/i.test(override) ? 'Pro' : 'User'
    }

    // Write to profiles.role_override (create row if needed)
    const { error } = await (supabase.from('profiles') as any)
      .upsert({ id: userId, role_override: value }, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Optionally promote auth metadata immediately if higher
    try {
      if (value) {
        await supabase.auth.admin.updateUserById(userId, { app_metadata: { role: value } })
      }
    } catch {}

    // Notify clients to refresh role quickly (optional)
    try { /* no-op broadcast */ } catch {}

    return NextResponse.json({ ok: true, userId, override: value })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


