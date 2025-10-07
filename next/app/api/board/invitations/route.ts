import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../src/features/storage/supabaseService'
import { sendEmail, sendTemplatedEmail } from '../../../../src/features/email/postmark'

// POST: Send invitation { boardId, email }
// GET: Fetch invitations for current user (by email)

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const { boardId, email, invitedBy, boardName, boardUrl, role } = await req.json()
    if (!boardId || !email || !invitedBy) {
      return NextResponse.json({ error: 'Missing boardId, email, or invitedBy' }, { status: 400 })
    }
    const emailTrim = String(email).trim()
    const isValid = /[^@\s]+@[^@\s]+\.[^@\s]+/.test(emailTrim)
    if (!isValid) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

    const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || ''
    const link = typeof boardUrl === 'string' && boardUrl.length > 0 ? boardUrl : `${origin}/board/${boardId}`
    const name = typeof boardName === 'string' && boardName.length > 0 ? boardName : 'a board'

    const inviteRole = (typeof role === 'string' && ['owner','editor','viewer'].includes(role)) ? role : 'editor'
    const { data, error } = await supabase.from('board_invitations').insert([
      { board_id: boardId, email: emailTrim, invited_by: invitedBy, role: inviteRole }
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Lookup invited user id by email (if they already have an account)
    let invitedUserId: string | null = null
    try {
      const { data: lu } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
      const match = (lu?.users || []).find((u: any) => String(u.email || '').toLowerCase() === emailTrim.toLowerCase())
      invitedUserId = match?.id || null
    } catch {}

    // Resolve inviter label (username/email)
    let inviterLabel = 'someone'
    try {
      const [{ data: inviterUser }, { data: inviterProf }] = await Promise.all([
        supabase.auth.admin.getUserById(invitedBy),
        supabase.from('profiles').select('username').eq('id', invitedBy).maybeSingle(),
      ])
      const inviterEmail = (inviterUser?.user?.email || '').trim()
      inviterLabel = (inviterProf as any)?.username || inviterEmail || 'someone'
    } catch {}

    // Create notifications
    try {
      // For invited user
      if (invitedUserId) {
        await supabase.from('notifications').insert({
          user_id: invitedUserId,
          type: 'board_invite',
          title: `New board shared with you by ${inviterLabel}`,
          body: `You have been invited to \"${name}\"`,
          payload: { boardId, boardName: name, link, invitedBy, inviterLabel }
        })
      }
      // For inviter
      await supabase.from('notifications').insert({
        user_id: invitedBy,
        type: 'board_invite',
        title: 'Invitation sent',
        body: `Shared \"${name}\" with ${emailTrim}.`,
        payload: { boardId, boardName: name, link, email, inviterLabel }
      })
    } catch {}

    // Send email to invitee using Postmark template if configured
    const templateId = Number(process.env.POSTMARK_BOARD_INVITE_TEMPLATE_ID || 0) || 41734537
    await sendTemplatedEmail({
      to: emailTrim,
      templateId,
      templateModel: {
        board_name: name,
        board_link: link,
        inviter_label: inviterLabel,
        invitee_email: emailTrim,
        role: inviteRole,
      },
    })

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create invitation' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Get user email from query param (for now, since we don't have SSR session)
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('board_invitations')
    .select('*')
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ invitations: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseServiceClient()
  const { id, status } = await req.json()
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('board_invitations')
    .update({ status })
    .eq('id', id)
    .select()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}
