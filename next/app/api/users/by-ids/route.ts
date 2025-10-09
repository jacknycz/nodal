import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ users: [] })
    }
    const supabase = getSupabaseServiceClient()
    const unique = Array.from(new Set(ids.map((v: any) => String(v))))
    const batches = await Promise.allSettled(unique.map(async (id: string) => {
      const { data } = await supabase.auth.admin.getUserById(id)
      const email = data?.user?.email || null
      return { id, email }
    }))
    const users = batches
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean)
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch users' }, { status: 500 })
  }
}


