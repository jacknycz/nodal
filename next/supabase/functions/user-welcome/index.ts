console.log('[welcome] starting')

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    // Shared secret from DB trigger or Auth Hook
    const expected = Deno.env.get('AUTH_HOOK_SECRET') || ''
    const received = req.headers.get('x-auth-hook-secret') || ''
    if (!expected) return new Response('Missing AUTH_HOOK_SECRET', { status: 500 })
    if (!received || received !== expected) return new Response('Unauthorized', { status: 401 })

    // Parse payload
    let payload: any = {}
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        payload = await req.json()
      }
    } catch {}

    const user = (payload?.record || payload?.user || payload?.new) || {}
    const email: string = String(user?.email || '').trim()
    const name: string = String(user?.user_metadata?.name || (email ? email.split('@')[0] : 'there')).trim()
    if (!email) {
      console.log('[welcome] no email; skipping')
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    const serverToken = Deno.env.get('POSTMARK_SERVER_TOKEN') || ''
    const fromEmail = Deno.env.get('POSTMARK_FROM_EMAIL') || ''
    const stream = Deno.env.get('POSTMARK_MESSAGE_STREAM') || 'outbound'
    const templateId = Number(Deno.env.get('POSTMARK_WELCOME_TEMPLATE_ID') || '0')

    if (!serverToken || !fromEmail || !templateId) {
      console.log('[welcome] missing Postmark envs; skipping', { hasToken: !!serverToken, from: !!fromEmail, templateId })
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    // Templated send first
    try {
      const r = await fetch('https://api.postmarkapp.com/email/withTemplate', {
        method: 'POST',
        headers: { 'X-Postmark-Server-Token': serverToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: fromEmail, To: email, TemplateId: templateId, TemplateModel: { user_name: name, user_email: email }, MessageStream: stream })
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        console.log('[welcome] templated sent', { to: email, id: j?.MessageID || j?.MessageId })
        return new Response(JSON.stringify({ ok: true, templated: true }), { status: 200 })
      }
      console.error('[welcome] templated error', { status: r.status, json: j })
    } catch (e) {
      console.error('[welcome] templated exception', String(e))
    }

    // Plain fallback
    try {
      const subject = `Welcome to Nodal, ${name}`
      const text = `Hi ${name},\n\nWelcome to Nodal!\nYour account: ${email}\n\nWe’re excited to have you.`
      const r2 = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: { 'X-Postmark-Server-Token': serverToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: fromEmail, To: email, Subject: subject, TextBody: text, MessageStream: stream })
      })
      const j2 = await r2.json().catch(() => ({}))
      if (!r2.ok) {
        console.error('[welcome] plain error', { status: r2.status, json: j2 })
        return new Response(JSON.stringify({ ok: false, fallback: true, error: j2 }), { status: 200 })
      }
      console.log('[welcome] plain sent', { to: email, id: j2?.MessageID || j2?.MessageId })
      return new Response(JSON.stringify({ ok: true, fallback: true }), { status: 200 })
    } catch (e) {
      console.error('[welcome] plain exception', String(e))
      return new Response(JSON.stringify({ ok: false, error: 'send failed' }), { status: 200 })
    }
  } catch (e) {
    console.error('[welcome] error', e)
    return new Response('Internal Server Error', { status: 500 })
  }
})
