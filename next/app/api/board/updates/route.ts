import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}))
    const boardId = String(payload?.boardId || '')
    const nodeId = payload?.nodeId ? String(payload.nodeId) : null
    const updateType = String(payload?.updateType || '')
    const data = payload?.data ?? null

    // Basic validation; still succeed (204) even if missing to avoid noisy console errors
    if (!boardId || !updateType) return new NextResponse(null, { status: 204 })

    // Best-effort insert into board_updates if table exists
    try {
      const supabase = getSupabaseServiceClient()
      // Optional: attach user id from Authorization Bearer if present
      let userId: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7)
          const { data: u } = await supabase.auth.getUser(token)
          userId = u?.user?.id || null
        } catch {}
      }
      await supabase
        .from('board_updates' as any)
        .insert({
          board_id: boardId,
          node_id: nodeId,
          update_type: updateType,
          data,
          user_id: userId,
          created_at: new Date().toISOString(),
        } as any)
    } catch {
      // Silently ignore if table does not exist or lacks permissions
    }

    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}


