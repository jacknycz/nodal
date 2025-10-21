import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../src/features/storage/supabaseService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { model, messages, temperature, max_tokens, presence_penalty, frequency_penalty, stop, stream } = body || {}

    // Identify user (prefer Supabase auth header; fallback x-user-id for dev/testing)
    const supabase = getSupabaseServiceClient()
    let userId: string | null = null
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const { data } = await supabase.auth.getUser(token)
        userId = data.user?.id || null
      }
    } catch {}
    if (!userId) {
      const hdr = req.headers.get('x-user-id')
      if (hdr) userId = hdr
    }

    // Soft cap check before proxying
    try {
      if (userId) {
        // Determine monthly cap from role
        let cap = 15000
        try {
          const prof = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
          const role = (prof.data as any)?.role || 'User'
          const rl = String(role).toLowerCase()
          if (rl === 'pro') cap = 100000
          if (rl === 'admin') cap = Number.MAX_SAFE_INTEGER
        } catch {}
        if (cap !== Number.MAX_SAFE_INTEGER) {
          const now = new Date()
          const start = new Date(now.getFullYear(), now.getMonth(), 1)
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

    const apiKey = process.env.OPENAI_API_KEY || req.headers.get('x-openai-api-key') || ''
    if (!apiKey) return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 401 })

    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens,
      presence_penalty,
      frequency_penalty,
      stop,
      stream: !!stream,
    }

    // Proxy to OpenAI
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
            await supabase.from('ai_usage').insert({ user_id: userId, tokens_used: estTokens, model: model || null })
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
      const tokens = Number(json?.usage?.total_tokens || 0)
      if (userId && tokens > 0) {
        await supabase.from('ai_usage').insert({ user_id: userId, tokens_used: tokens, model: model || null })
      }
    } catch {}
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI proxy failed' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
