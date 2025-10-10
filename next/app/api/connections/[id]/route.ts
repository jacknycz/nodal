import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'
import { sendEmail } from '../../../../src/features/email/postmark'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseServiceClient()
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (!id || !['accept','decline','block','unblock','cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { data: existing, error: exErr } = await supabase.from('connections').select('*').eq('id', id).maybeSingle()
    if (exErr) throw exErr
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let status = existing.status
    if (action === 'accept') status = 'accepted'
    if (action === 'decline') status = 'declined'
    if (action === 'block') status = 'blocked'
    if (action === 'unblock') status = 'declined'
    if (action === 'cancel') status = 'declined'

    const { data: up, error: upErr } = await supabase
      .from('connections')
      .update({ status })
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (upErr) throw upErr

    // Send emails on accept
    if (action === 'accept') {
      const reqId = String(up?.requester_id || '')
      const addId = String(up?.addressee_id || '')
      if (reqId) await sendUserEmail(supabase, reqId, 'Connection accepted', 'You are now connected.')
      if (addId) await sendUserEmail(supabase, addId, 'Connection accepted', 'You are now connected.')
    }

    return NextResponse.json({ ok: true, connection: up })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseServiceClient()
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabase.from('connections').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}

async function sendUserEmail(supabase: any, userId: string, subject: string, body: string) {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const email = (data?.user?.email || '').trim()
    if (email) await sendEmail({ to: email, subject, text: body })
  } catch {}
}


