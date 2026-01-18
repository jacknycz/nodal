import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key =
    (process.env.SUPABASE_SECRET_KEY as string) ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY as string) // legacy fallback
  if (!url || !key) throw new Error('Supabase secret key not configured')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const { boardId, nodeId, userId } = await req.json()
    if (!boardId || !nodeId || !userId) return NextResponse.json({ error: 'Missing boardId, nodeId, or userId' }, { status: 400 })
    const supabase = getServiceClient()
    console.log('[locks-api] POST acquire', { boardId, nodeId, userId })

    // Check existing lock
    const { data: existingLock, error: checkError } = await supabase
      .from('node_locks')
      .select('*')
      .eq('board_id', boardId)
      .eq('node_id', nodeId)
      .single()

    if (checkError && (checkError as any).code !== 'PGRST116') {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existingLock && existingLock.user_id !== userId) {
      console.log('[locks-api] conflict existing lock owner', { owner: existingLock.user_id })
      return NextResponse.json({ error: 'Node is already locked by another user', lockedBy: existingLock.user_id }, { status: 409 })
    }

    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString()

    if (existingLock && existingLock.user_id === userId) {
      const { data, error } = await supabase
        .from('node_locks')
        .update({ locked_at: new Date().toISOString(), expires_at: expiresAt })
        .eq('board_id', boardId)
        .eq('node_id', nodeId)
        .eq('user_id', userId)
        .select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, lock: data?.[0] })
    }

    const { data, error } = await supabase
      .from('node_locks')
      .insert({ board_id: boardId, node_id: nodeId, user_id: userId, locked_at: new Date().toISOString(), expires_at: expiresAt })
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, lock: data?.[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { boardId, nodeId, userId } = await req.json()
    if (!boardId || !nodeId || !userId) return NextResponse.json({ error: 'Missing boardId, nodeId, or userId' }, { status: 400 })
    const supabase = getServiceClient()
    console.log('[locks-api] DELETE release', { boardId, nodeId, userId })
    const { error } = await supabase
      .from('node_locks')
      .delete()
      .eq('board_id', boardId)
      .eq('node_id', nodeId)
      .eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get('boardId')
    if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 })
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('node_locks')
      .select('*')
      .eq('board_id', boardId)
      .gt('expires_at', new Date().toISOString())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ locks: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
