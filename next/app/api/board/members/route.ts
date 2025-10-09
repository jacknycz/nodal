import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get('boardId')
    if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data: members, error } = await supabase
      .from('board_members')
      .select('user_id, role')
      .eq('board_id', boardId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const ids = (members || []).map((m: any) => m.user_id)

    // Fetch emails and usernames
    const [{ users }, { data: profiles }] = await Promise.all([
      (async () => {
        try {
          const out: Array<{ id: string; email: string | null }> = []
          for (const id of ids) {
            const { data } = await supabase.auth.admin.getUserById(id)
            out.push({ id, email: data?.user?.email || null })
          }
          return { users: out }
        } catch { return { users: [] } }
      })(),
      supabase.from('profiles').select('id, username').in('id', ids),
    ])

    const emailMap = new Map<string, string | null>()
    for (const u of users || []) emailMap.set(u.id, u.email || null)
    const usernameMap = new Map<string, string | null>()
    ;(profiles || []).forEach((p: any) => usernameMap.set(p.id, p.username || null))

    const result = (members || []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      email: emailMap.get(m.user_id) || null,
      username: usernameMap.get(m.user_id) || null,
    }))
    return NextResponse.json({ members: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch members' }, { status: 500 })
  }
}


