import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '../../../../src/features/auth/supabaseClient'

const supabase = getSupabaseClient()

export async function POST(req: NextRequest) {
  try {
    const { boardId, nodeId, userId } = await req.json()
    
    if (!boardId || !nodeId || !userId) {
      return NextResponse.json({ error: 'Missing boardId, nodeId, or userId' }, { status: 400 })
    }

    // Check if node is already locked
    const { data: existingLock, error: checkError } = await supabase
      .from('node_locks')
      .select('*')
      .eq('board_id', boardId)
      .eq('node_id', nodeId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    // If lock exists and is owned by someone else, deny access
    if (existingLock && existingLock.user_id !== userId) {
      return NextResponse.json({ 
        error: 'Node is already locked by another user',
        lockedBy: existingLock.user_id 
      }, { status: 409 })
    }

    // If we already own the lock, just update the expiration
    if (existingLock && existingLock.user_id === userId) {
      const { data, error } = await supabase
        .from('node_locks')
        .update({
          locked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        })
        .eq('board_id', boardId)
        .eq('node_id', nodeId)
        .eq('user_id', userId)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, lock: data[0] })
    }

    // Create new lock
    const { data, error } = await supabase
      .from('node_locks')
      .insert({
        board_id: boardId,
        node_id: nodeId,
        user_id: userId,
        locked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lock: data[0] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { boardId, nodeId, userId } = await req.json()
    
    if (!boardId || !nodeId || !userId) {
      return NextResponse.json({ error: 'Missing boardId, nodeId, or userId' }, { status: 400 })
    }

    // Only allow the user who locked the node to release it
    const { error } = await supabase
      .from('node_locks')
      .delete()
      .eq('board_id', boardId)
      .eq('node_id', nodeId)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get('boardId')
    
    if (!boardId) {
      return NextResponse.json({ error: 'Missing boardId' }, { status: 400 })
    }

    // Get all locks for the board, excluding expired ones
    const { data, error } = await supabase
      .from('node_locks')
      .select('*')
      .eq('board_id', boardId)
      .gt('expires_at', new Date().toISOString())

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ locks: data || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
