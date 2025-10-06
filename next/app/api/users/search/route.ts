import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }
    const supabase = getSupabaseServiceClient()

    // Search profiles by username (ILIKE)
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(10)

    let profileResults = (profs || []).map((p: any) => ({
      id: p.id,
      username: p.username || null,
      avatar_url: p.avatar_url || null,
      email: null as string | null,
      source: 'username'
    }))

    // Email search via auth admin (substring match), regardless of '@'
    let emailResults: any[] = []
    try {
      const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
      const users = (data?.users || []).filter((u: any) => String(u.email || '').toLowerCase().includes(q.toLowerCase()))
      if (users.length > 0) {
        const ids = users.map((u: any) => u.id)
        const { data: profsById } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
        const mapById = new Map<string, any>((profsById || []).map((r: any) => [r.id, r]))
        emailResults = users.map((u: any) => ({
          id: u.id,
          username: (mapById.get(u.id)?.username ?? null) as string | null,
          avatar_url: (mapById.get(u.id)?.avatar_url ?? null) as string | null,
          email: u.email as string,
          source: 'email'
        }))
      }
    } catch {
      // ignore
    }

    // Enrich profileResults emails by admin list (so Share button can be enabled)
    try {
      const { data: adminList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const idToEmail = new Map<string, string>((adminList?.users || []).map((u: any) => [u.id, u.email]))
      profileResults = profileResults.map((r: any) => ({ ...r, email: r.email || idToEmail.get(r.id) || null }))
    } catch {
      // ignore
    }

    // Merge and de-dupe by id
    const combined = [...profileResults, ...emailResults]
    const seen = new Set<string>()
    const results = combined.filter(r => {
      if (!r.id || seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 })
  }
}


