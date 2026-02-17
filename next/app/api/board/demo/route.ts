import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

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

export async function POST(req: NextRequest) {
  try {
    const { boardId } = await req.json()
    if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 })

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseServiceClient()
    const token = authHeader.slice(7)
    const { data: u, error: uErr } = await supabase.auth.getUser(token)
    const user = u?.user || null
    if (uErr || !user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: src, error: srcErr } = await supabase
      .from('boards')
      .select('id, name, data, ai_style')
      .eq('id', boardId)
      .single()
    if (srcErr || !src) return NextResponse.json({ error: srcErr?.message || 'Board not found' }, { status: 404 })

    const now = Date.now()
    const newId = crypto.randomUUID()
    const data = (src as any).data || {}
    const nodeCount = Array.isArray(data?.nodes) ? data.nodes.length : 0
    const edgeCount = Array.isArray(data?.edges) ? data.edges.length : 0
    const demoNameBase = String((src as any).name || 'Board').trim() || 'Board'
    const demoName = `${demoNameBase} (Demo)`

    const { data: inserted, error: insErr } = await supabase
      .from('boards')
      .insert({
        id: newId,
        name: demoName,
        data,
        user_id: user.id,
        created_at: now,
        last_modified: now,
        node_count: nodeCount,
        edge_count: edgeCount,
        is_public: true,
        is_demo: true,
        ai_style: (src as any).ai_style ?? null,
      } as any)
      .select('id')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ id: inserted.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create demo board' }, { status: 500 })
  }
}

