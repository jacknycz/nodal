import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { model, messages, temperature, max_tokens, presence_penalty, frequency_penalty, stop, stream } = body || {}

    // Identify user (prefer Supabase auth header; fallback x-user-id for dev/testing)
    const supabase = getSupabaseServiceClient()
    let userId: string | null = null
    let roleFromAuth: string | null = null
    let userCreatedAt: string | null = null
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const { data } = await supabase.auth.getUser(token)
        userId = data.user?.id || null
        userCreatedAt = (data.user as any)?.created_at || null
        try {
          // Prefer app_metadata.role; fallback to user_metadata.role
          // @ts-expect-error metadata may be any
          roleFromAuth = (data.user?.app_metadata?.role as string) || (data.user?.user_metadata?.role as string) || null
        } catch {}
      }
    } catch {}
    if (!userId) {
      const hdr = req.headers.get('x-user-id')
      if (hdr) userId = hdr
    }

    // Soft cap check before proxying
    try {
      const boardIdHeader = req.headers.get('x-board-id') || null
      if (userId) {
        const normalizeRole = (r: any): 'Admin' | 'Pro' | 'User' => {
          const s = String(r || '').trim().toLowerCase()
          if (s === 'admin') return 'Admin'
          if (s === 'pro') return 'Pro'
          return 'User'
        }
        const rank = (r: 'Admin' | 'Pro' | 'User') => (r === 'Admin' ? 3 : r === 'Pro' ? 2 : 1)

        // Determine effective role using canonical profile fields (role_override/subscription_status),
        // while also honoring auth metadata promotions.
        let dbRole: string | null = null
        let roleOverride: string | null = null
        let subscriptionStatus: string | null = null
        let currentPeriodStart: string | null = null
        try {
          const prof = await supabase
            .from('profiles')
            .select('role, role_override, subscription_status, current_period_start')
            .eq('id', userId)
            .maybeSingle()
          dbRole = (prof.data as any)?.role || null
          roleOverride = (prof.data as any)?.role_override || null
          subscriptionStatus = (prof.data as any)?.subscription_status || null
          currentPeriodStart = (prof.data as any)?.current_period_start || null
        } catch {}

        let effectiveRole: 'Admin' | 'Pro' | 'User' = 'User'
        const overrideNorm = normalizeRole(roleOverride)
        if (roleOverride && /^(admin|pro|user)$/i.test(String(roleOverride))) {
          effectiveRole = overrideNorm
        } else {
          const isSubPro = ['active', 'trialing', 'past_due'].includes(String(subscriptionStatus || '').toLowerCase())
          effectiveRole = isSubPro ? 'Pro' : 'User'
        }

        // Promote-only: auth metadata and dbRole can only increase privileges
        const authNorm = normalizeRole(roleFromAuth)
        if (rank(authNorm) > rank(effectiveRole)) effectiveRole = authNorm
        const dbNorm = normalizeRole(dbRole)
        if (rank(dbNorm) > rank(effectiveRole)) effectiveRole = dbNorm

        // Map role -> cap (Free 15k, Pro 100k, Admin unlimited)
        let cap = 15000
        if (effectiveRole === 'Pro') cap = 100000
        if (effectiveRole === 'Admin') cap = Number.MAX_SAFE_INTEGER

        if (cap !== Number.MAX_SAFE_INTEGER) {
          const now = new Date()
          let start = new Date(now.getFullYear(), now.getMonth(), 1)

          // Align Pro users to the Stripe period start when available on the profile
          if (effectiveRole === 'Pro' && currentPeriodStart) {
            try {
              const cps = new Date(currentPeriodStart)
              if (!Number.isNaN(cps.getTime())) start = cps
            } catch {}
          } else if (effectiveRole === 'User') {
            // Free users: use signup day-of-month as the window anchor (matches /api/usage)
            try {
              const anchorDay = (() => {
                if (userCreatedAt) return new Date(userCreatedAt).getDate()
                return now.getDate() // fallback
              })()
              const clampDay = (y: number, m: number, d: number) => {
                const last = new Date(y, m + 1, 0).getDate()
                return Math.min(d, last)
              }
              const dayThisMonth = clampDay(now.getFullYear(), now.getMonth(), anchorDay)
              const candidate = new Date(now.getFullYear(), now.getMonth(), dayThisMonth)
              if (now.getDate() >= dayThisMonth) {
                start = candidate
              } else {
                const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const dayPrevMonth = clampDay(prevMonth.getFullYear(), prevMonth.getMonth(), anchorDay)
                start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayPrevMonth)
              }
            } catch {}
          }
          const { data: usageRows } = await supabase
            .from('ai_usage')
            .select('tokens_used')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
          const used = (usageRows || []).reduce((s: number, r: any) => s + Number(r.tokens_used || 0), 0)
          if (used >= cap) {
            return NextResponse.json({ error: 'Monthly AI token limit reached. Visit Profile to upgrade or buy packs.' }, { status: 402 })
          }
        }
      }
    } catch {}

    const gatewayKey = process.env.AI_GATEWAY_API_KEY || ''
    const useGateway = !!gatewayKey
    const apiKey = process.env.OPENAI_API_KEY || req.headers.get('x-openai-api-key') || ''
    if (!useGateway && !apiKey) return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 401 })

    // Vercel AI Gateway is OpenAI-compatible. For gateway calls, model ids should be `provider/model`.
    // Keep backwards compatibility with legacy model ids like `gpt-4o-mini` by defaulting to `openai/...`.
    // IMPORTANT: When *not* using the gateway, OpenAI expects raw model ids (e.g. `gpt-4o-mini`),
    // so we strip `openai/` if the UI passes a provider-prefixed id.
    const upstreamModel = (() => {
      if (typeof model !== 'string') return model
      const m = model.trim()
      if (!m) return model

      if (useGateway) {
        return m.includes('/') ? m : `openai/${m}`
      }

      // Direct OpenAI: accept `openai/<id>` by stripping prefix; reject non-openai provider ids.
      if (m.startsWith('openai/')) return m.slice('openai/'.length)
      if (m.includes('/')) {
        throw new Error('Model requires AI Gateway (provider-prefixed model id)')
      }
      return m
    })()

    const payload: any = {
      model: upstreamModel,
      messages,
      temperature,
      max_tokens,
      presence_penalty,
      frequency_penalty,
      stop,
      stream: !!stream,
    }

    const upstreamUrl = useGateway
      ? 'https://ai-gateway.vercel.sh/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const upstreamAuth = useGateway ? gatewayKey : apiKey

    // Proxy to upstream (AI Gateway or OpenAI)
    const resp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${upstreamAuth}`,
      },
      body: JSON.stringify(payload),
    })

    // Streaming passthrough
    if (stream) {
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}))
        return NextResponse.json({ error: err?.error || resp.statusText }, { status: resp.status })
      }
      // Accumulate for rough token estimate
      const reader = resp.body.getReader()
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed.choices?.[0]?.delta?.content || ''
                  fullContent += delta
                } catch {}
              }
            }
          }
          await writer.write(encoder.encode(chunk))
        }
        writer.close()
        // Log usage with best-effort estimate (4 chars ~ 1 token)
        try {
          if (userId) {
            const estTokens = Math.ceil(fullContent.length / 4)
            await supabase.from('ai_usage').insert({ user_id: userId, tokens_used: estTokens, model: model || null, board_id: boardIdHeader })
          }
        } catch {}
      }
      pump()
      return new NextResponse(readable as any, {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }

    // Non-streaming
    const json = await resp.json()
    if (!resp.ok) {
      return NextResponse.json(json, { status: resp.status })
    }
    try {
      const boardIdHeader = req.headers.get('x-board-id') || null
      const tokens = Number(json?.usage?.total_tokens || 0)
      if (userId && tokens > 0) {
        await supabase.from('ai_usage').insert({ user_id: userId, tokens_used: tokens, model: model || null, board_id: boardIdHeader })
      }
    } catch {}
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI proxy failed' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
