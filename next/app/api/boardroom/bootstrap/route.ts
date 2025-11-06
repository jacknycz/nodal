import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getUserFromAuthHeader(req: NextRequest) {
  const supabase = getSupabaseServiceClient()
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) return user
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const user = await getUserFromAuthHeader(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Shared boards (mirror /api/board/shared)
    const { data: memberRows } = await supabase
      .from('board_members')
      .select('board_id')
      .eq('user_id', user.id)
    const boardIds = Array.from(new Set((memberRows || []).map((r: any) => r.board_id)))

    // Accepted invites by email (case-insensitive)
    let inviteBoardIds: string[] = []
    try {
      if (user.email) {
        const { data: invites } = await supabase
          .from('board_invitations')
          .select('board_id')
          .eq('status', 'accepted')
          .ilike('email', user.email)
        inviteBoardIds = Array.from(new Set((invites || []).map((r: any) => r.board_id)))
      }
    } catch {}

    const allSharedIds = Array.from(new Set([...boardIds, ...inviteBoardIds])).filter(Boolean)
    let sharedBoards: any[] = []
    if (allSharedIds.length > 0) {
      const { data: sboards } = await supabase
        .from('boards')
        .select('*')
        .in('id', allSharedIds)
      sharedBoards = (sboards || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        userId: b.user_id,
        createdAt: b.created_at ? new Date(b.created_at).getTime() : undefined,
        lastModified: b.last_modified ? Number(b.last_modified) : undefined,
        data: b.data || null,
      }))
    }

    // Connections (mirror /api/connections GET) with enrichment
    const { data: conns } = await supabase
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    const rows = conns || []
    const ids = Array.from(new Set(rows.flatMap((r: any) => [r.requester_id, r.addressee_id]).filter(Boolean)))
    let profilesById = new Map<string, any>()
    try {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      profilesById = new Map<string, any>((profs || []).map((p: any) => [p.id, p]))
    } catch {}
    const emailsById = new Map<string, string>()
    try {
      await Promise.all(ids.map(async (id) => {
        try {
          const { data: u } = await supabase.auth.admin.getUserById(id)
          const email = (u?.user?.email || '').trim()
          if (email) emailsById.set(id, email)
        } catch {}
      }))
    } catch {}
    const connections = rows.map((r: any) => ({
      ...r,
      requester: {
        id: r.requester_id,
        username: profilesById.get(r.requester_id)?.username || null,
        avatar_url: profilesById.get(r.requester_id)?.avatar_url || null,
        email: emailsById.get(r.requester_id) || null,
      },
      addressee: {
        id: r.addressee_id,
        username: profilesById.get(r.addressee_id)?.username || null,
        avatar_url: profilesById.get(r.addressee_id)?.avatar_url || null,
        email: emailsById.get(r.addressee_id) || null,
      }
    }))

    // News (latest or published-only)
    let news: any[] = []
    try {
      const isAdmin = (user.app_metadata as any)?.role === 'Admin'
      const base = supabase.from('nodal_news').select('id,title,content,published,created_at').order('created_at', { ascending: false })
      const { data, error } = isAdmin ? await base : await base.eq('published', true).limit(3)
      if (error) throw error
      news = data || []
    } catch {}

    return NextResponse.json({ sharedBoards, connections, news })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bootstrap failed' }, { status: 500 })
  }
}


