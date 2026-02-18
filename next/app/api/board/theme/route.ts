import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

const ALLOWED_THEMES = new Set(['default', 'red', 'presentation', 'education', 'creative', 'technical', 'scifi'])
const ALLOWED_UI_MODES = new Set(['light', 'dark'])
const ALLOWED_OVERRIDE_KEYS = new Set([
  'background',
  'nodeColor',
  'nodeTitleColor',
  'nodeContentColor',
  'headlineColor',
  'nodeBorderRadius',
  'edgeColor',
  'edgeHighlightColor',
  'edgeHighlightPulseColor',
  'edgeArrowColor',
  'edgeAccentColor',
])

function isValidHexColor(v: string): boolean {
  const s = String(v || '').trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)
}

function sanitizeOverrides(input: any): any | null {
  if (!input || typeof input !== 'object') return null
  const out: any = {}
  for (const [k, raw] of Object.entries(input)) {
    if (!ALLOWED_OVERRIDE_KEYS.has(String(k))) continue
    const v = typeof raw === 'string' ? raw.trim() : ''
    if (!v) continue
    if (String(k) === 'nodeBorderRadius') {
      // Not a color; allow simple CSS length strings like "12px" / "0.75rem"
      out[k] = v
      continue
    }
    if (!isValidHexColor(v)) continue
    out[k] = v
  }
  return Object.keys(out).length ? out : null
}

function isAdminUser(user: any): boolean {
  if (!user) return false
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || '').trim().toLowerCase()
  if (role === 'admin') return true

  const DEFAULT_ADMIN_EMAILS = ['jack.nycz@gmail.com']
  const env = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const allow = new Set([...DEFAULT_ADMIN_EMAILS, ...env].map((e) => e.toLowerCase()))
  const email = String(user?.email || '').toLowerCase()
  return allow.has(email)
}

function isProUser(user: any): boolean {
  if (!user) return false
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || '').trim().toLowerCase()
  return role === 'pro' || role === 'pro_user' || role === 'prouser' || role === 'pro-user'
}

export async function POST(req: NextRequest) {
  try {
    const { boardId, theme, uiMode, overrides } = await req.json()
    const themeKey = String(theme || '').trim().toLowerCase()
    if (!boardId || !ALLOWED_THEMES.has(themeKey)) {
      return NextResponse.json({ error: 'Missing boardId or invalid theme' }, { status: 400 })
    }

    const rawUiMode = (uiMode === null || typeof uiMode === 'undefined') ? null : String(uiMode || '').trim().toLowerCase()
    const uiModeKey = rawUiMode ? (ALLOWED_UI_MODES.has(rawUiMode) ? rawUiMode : null) : null
    if (rawUiMode && !uiModeKey) {
      return NextResponse.json({ error: 'Invalid uiMode' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseServiceClient()
    const token = authHeader.slice(7)
    const { data: u, error: uErr } = await supabase.auth.getUser(token)
    const user = u?.user || null
    const userId = user?.id || null
    if (uErr || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = isAdminUser(user)
    const pro = isProUser(user)

    // Admin can theme any board; otherwise require ownership + Pro.
    if (!admin) {
      if (!pro) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
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
    }

    const sanitizedOverrides = themeKey === 'default' ? null : sanitizeOverrides(overrides)

    const payload: any = {
      board_theme: themeKey,
      // If switching base theme, client should send overrides=null; we sanitize either way.
      board_theme_overrides: themeKey === 'default' ? null : sanitizedOverrides,
      // UI mode is only meaningful for non-default themes. If theme is default, clear it.
      board_ui_mode: themeKey === 'default' ? null : (uiModeKey || 'light'),
      last_modified: Date.now(),
    }
    let { error } = await supabase
      .from('boards')
      .update(payload)
      .eq('id', boardId)

    // Backward-compatible fallback when schema hasn't been migrated yet
    if (error && String(error?.message || '').toLowerCase().includes('board_ui_mode')) {
      const legacyPayload: any = { ...payload }
      delete legacyPayload.board_ui_mode
      ;({ error } = await supabase.from('boards').update(legacyPayload).eq('id', boardId))
    }

    if (error) {
      const msg = String(error?.message || '')
      // Helpful guidance when the database hasn't been migrated for new theme keys.
      if (msg.toLowerCase().includes('boards_board_theme_check')) {
        return NextResponse.json(
          { error: 'Database constraint blocks this theme. Run the migration to update boards_board_theme_check to allow the new theme keys.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update board theme' }, { status: 500 })
  }
}

