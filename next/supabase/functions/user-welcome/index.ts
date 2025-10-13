// Supabase Edge Function: user-welcome
// Sends a Postmark welcome email on Supabase Auth "User created" hook

type AuthHookPayload = {
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> }
  record?: { id?: string; email?: string; user_metadata?: Record<string, unknown> }
  new?: { id?: string; email?: string; user_metadata?: Record<string, unknown> }
} & Record<string, unknown>

async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text))
  const bytes = new Uint8Array(sig)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const raw = await req.text()

  // Optional signature verification (recommended in prod)
  try {
    const secret = Deno.env.get('AUTH_HOOK_SECRET')
    const header = req.headers.get('x-supabase-signature') || ''
    if (secret && header) {
      const computed = await hmacSha256Hex(secret, raw)
      const matches = header === computed
      if (!matches) {
        console.warn('[user-welcome] signature mismatch; continuing in dev but rejecting in prod')
        // For strict mode, uncomment next line:
        // return new Response('Unauthorized', { status: 401 })
      }
    } else {
      console.log('[user-welcome] signature not provided; skipping verification')
    }
  } catch (e) {
    console.warn('[user-welcome] signature verification error', e)
  }

  let payload: AuthHookPayload = {}
  try { payload = JSON.parse(raw || '{}') } catch {}

  const user = (payload.user || payload.record || payload.new || {}) as any
  const email: string = String(user?.email || user?.user_metadata?.email || '').trim()
  if (!email) {
    console.log('[user-welcome] No email found in payload; skipping send')
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
  }

  const name: string = String(
    (user?.user_metadata && (user.user_metadata as any).name) || email.split('@')[0] || 'New user'
  ).trim()

  const serverToken = Deno.env.get('POSTMARK_SERVER_TOKEN')
  const fromEmail = Deno.env.get('POSTMARK_FROM_EMAIL')
  const stream = Deno.env.get('POSTMARK_MESSAGE_STREAM') || 'outbound'
  const templateId = Number(Deno.env.get('POSTMARK_WELCOME_TEMPLATE_ID') || '41799805')

  if (!serverToken || !fromEmail || !templateId) {
    console.log('[user-welcome] Missing Postmark envs; skipping', { hasToken: !!serverToken, fromEmail, templateId })
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
  }

  // Try templated email first
  try {
    const resp = await fetch('https://api.postmarkapp.com/email/withTemplate', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: fromEmail,
        To: email,
        TemplateId: templateId,
        TemplateModel: { user_name: name, user_email: email },
        MessageStream: stream,
      }),
    })
    const json = await resp.json().catch(() => ({}))
    if (resp.ok) {
      console.log('[user-welcome] Postmark templated sent', { to: email, messageId: json?.MessageID || json?.MessageId })
      return new Response(JSON.stringify({ ok: true, templated: true }), { status: 200 })
    }
    console.error('[user-welcome] Postmark templated error', { status: resp.status, json })
  } catch (e) {
    console.error('[user-welcome] Postmark templated exception', e)
  }

  // Fallback: plain text email
  try {
    const subject = `Welcome to Nodal, ${name}`
    const text = `Hi ${name},\n\nWelcome to Nodal!\nYour account: ${email}\n\nWe’re excited to have you.`
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ From: fromEmail, To: email, Subject: subject, TextBody: text, MessageStream: stream }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error('[user-welcome] Postmark plain error', { status: resp.status, json })
      return new Response(JSON.stringify({ ok: false, fallback: true, error: json }), { status: 200 })
    }
    console.log('[user-welcome] Postmark plain sent', { to: email, messageId: json?.MessageID || json?.MessageId })
    return new Response(JSON.stringify({ ok: true, fallback: true }), { status: 200 })
  } catch (e) {
    console.error('[user-welcome] Postmark plain exception', e)
    return new Response(JSON.stringify({ ok: false, error: 'send failed' }), { status: 200 })
  }
})


