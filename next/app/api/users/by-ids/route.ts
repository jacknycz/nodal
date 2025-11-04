import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : []
    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ users: [] })
    }
    const supabase = getSupabaseServiceClient()
    // Fetch profiles usernames in batch
    const [{ data: profiles }, adminResults] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', userIds),
      (async () => {
        const out: Array<{ id: string; email: string | null }> = []
        for (const id of userIds) {
          try {
            const { data } = await supabase.auth.admin.getUserById(id)
            out.push({ id, email: data?.user?.email || null })
          } catch {
            out.push({ id, email: null })
          }
        }
        return out
      })(),
    ])

    const usernameMap = new Map<string, string | null>()
    ;(profiles || []).forEach((p: any) => usernameMap.set(String(p.id), p?.username || null))

    const users = (adminResults || []).map((u) => ({
      id: u.id,
      email: u.email,
      username: usernameMap.get(u.id) || null,
    }))
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ users: [], error: e?.message || 'failed' }, { status: 500 })
  }
}

