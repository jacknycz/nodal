export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const apiKey = process.env.OPENAI_API_KEY || req.headers.get('x-openai-api-key') || ''
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY on server' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    // Stream passthrough if requested
    const isStream = !!body?.stream
    if (isStream) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
          'Cache-Control': 'no-store',
        },
      })
    }

    const json = await res.json().catch(() => ({}))
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


