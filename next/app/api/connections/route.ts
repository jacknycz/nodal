import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../src/features/storage/supabaseService'
import { sendEmail } from '../../../src/features/email/postmark'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    // Expect Authorization header with user id from middleware or pass user via query in dev.
    // For simplicity, we read from cookies/session not available here; use service client and require userId query.
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    const rows = data || []
    // Enrich with requester/addressee usernames and emails
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

    const enriched = rows.map((r: any) => ({
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

    return NextResponse.json({ connections: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load connections' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient()
    const body = await req.json().catch(() => ({}))
    const { requesterId, addresseeId } = body || {}
    if (!requesterId || !addresseeId || requesterId === addresseeId) {
      return NextResponse.json({ error: 'Invalid requester/addressee' }, { status: 400 })
    }

    // Check existing connection row for this unordered pair
    const { data: existing } = await supabase
      .from('connections')
      .select('*')
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json({ ok: true, connection: existing })
      }
      if (existing.requester_id === addresseeId && existing.addressee_id === requesterId && existing.status === 'pending') {
        // Incoming pending from other side -> accept
        const { data: up, error: upErr } = await supabase
          .from('connections')
          .update({ status: 'accepted' })
          .eq('id', existing.id)
          .select('*')
          .maybeSingle()
        if (upErr) throw upErr
        // Notify both users
        await createNotification(supabase, requesterId, 'connection', 'Connection accepted', 'You are now connected.', { otherUserId: addresseeId })
        await createNotification(supabase, addresseeId, 'connection', 'Connection accepted', 'You are now connected.', { otherUserId: requesterId })
        await sendConnectionEmail(supabase, requesterId, 'Connection accepted', 'You are now connected.')
        await sendConnectionEmail(supabase, addresseeId, 'Connection accepted', 'You are now connected.')
        return NextResponse.json({ ok: true, connection: up })
      }
      // Otherwise, flip to pending from requester
      const { data: up, error: upErr } = await supabase
        .from('connections')
        .update({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
        .eq('id', existing.id)
        .select('*')
        .maybeSingle()
      if (upErr) throw upErr
      await createNotification(supabase, addresseeId, 'connection', 'New connection request', 'You have a new connection request.', { fromUserId: requesterId })
      await sendConnectionEmail(supabase, addresseeId, 'New connection request', 'You have a new connection request on Nodal.')
      return NextResponse.json({ ok: true, connection: up })
    }

    const { data: inserted, error } = await supabase
      .from('connections')
      .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
      .select('*')
      .maybeSingle()
    if (error) throw error

    await createNotification(supabase, addresseeId, 'connection', 'New connection request', 'You have a new connection request.', { fromUserId: requesterId })
    await sendConnectionEmail(supabase, addresseeId, 'New connection request', 'You have a new connection request on Nodal.')

    return NextResponse.json({ ok: true, connection: inserted })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create connection' }, { status: 500 })
  }
}

async function createNotification(supabase: any, userId: string, type: string, title: string, body: string, payload?: any) {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, body, payload: payload || null })
  } catch {}
}

async function sendConnectionEmail(supabase: any, userId: string, subject: string, body: string) {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const email = (data?.user?.email || '').trim()
    if (email) await sendEmail({ to: email, subject, text: body })
  } catch {}
}


