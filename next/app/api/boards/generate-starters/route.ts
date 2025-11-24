import { NextResponse } from 'next/server'

type GenerateRequest =
  | { type?: 'generate', topic: string, description?: string, max?: number }
  | { type: 'describe', topic?: string, description?: string, titles: string[] }

async function callOpenAI(messages: any[], maxTokens = 600): Promise<{ ok: boolean; status: number; content?: string; totalTokens?: number; error?: string }> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_SERVER
    if (!apiKey) {
      return { ok: false, status: 500, error: 'Server AI key not configured' }
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: false,
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return { ok: false, status: resp.status, error: err?.error?.message || resp.statusText }
    }
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const totalTokens = Number(data?.usage?.total_tokens ?? 0)
    return { ok: true, status: 200, content, totalTokens }
  } catch (e: any) {
    return { ok: false, status: 500, error: e?.message || 'Unknown error' }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest
    const mode = body.type || 'generate'
    const authHeader = req.headers.get('authorization') || ''
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    if (mode === 'describe') {
      const titles = Array.isArray((body as any).titles) ? (body as any).titles as string[] : []
      if (!titles.length) {
        return NextResponse.json({ error: 'No titles provided' }, { status: 400 })
      }
      const topic = (body as any).topic || ''
      const desc = (body as any).description || ''
      const prompt = [
        topic ? `Board topic: "${topic}".` : '',
        desc ? `Board description: "${desc}".` : '',
        'Write a concise, helpful 1-2 sentence description for each of the following node titles.',
        'Return ONLY a JSON array of strings, one description per title in the same order.',
        '',
        `Titles: ${JSON.stringify(titles)}`,
      ].filter(Boolean).join('\n')
      const systemPrompt = 'You return strictly JSON with no markdown fences.'
      const ai = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ], 400)
      if (!ai.ok) return NextResponse.json({ error: ai.error || 'AI error' }, { status: ai.status })
      // Report usage (non-blocking)
      try {
        if (ai.totalTokens && ai.totalTokens > 0) {
          await fetch(`${siteUrl}/api/usage/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
            body: JSON.stringify({ tokens: ai.totalTokens, model: 'gpt-4o-mini', feature: 'starter_descriptions' })
          }).catch(() => {})
        }
      } catch {}
      let jsonText = (ai.content || '').trim()
      if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      let arr: string[] = []
      try { arr = JSON.parse(jsonText) } catch {}
      if (!Array.isArray(arr) || !arr.length) {
        // Fallback: simple templated descriptions
        arr = titles.map(t => `Brief overview and key details for "${t}".`)
      }
      return NextResponse.json({ descriptions: arr })
    }

    // Default: generate starters
    const topic = (body as any).topic || ''
    const desc = (body as any).description || ''
    const max = Math.max(3, Math.min(Number((body as any).max) || 5, 10))
    const prompt = `Create ${max} starter nodes for a board about "${topic}" with description: "${desc}". 
Return them as a JSON array of objects: [{ "label": "Node title", "content": "Brief description" }]. Diverse and actionable. Return ONLY the JSON array.`
    const systemPrompt = 'You return strictly JSON with no markdown fences.'
    const ai = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], 800)
    if (!ai.ok) return NextResponse.json({ error: ai.error || 'AI error' }, { status: ai.status })
    // Report usage (non-blocking)
    try {
      if (ai.totalTokens && ai.totalTokens > 0) {
        await fetch(`${siteUrl}/api/usage/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
          body: JSON.stringify({ tokens: ai.totalTokens, model: 'gpt-4o-mini', feature: 'board_starters' })
        }).catch(() => {})
      }
    } catch {}
    let jsonText = (ai.content || '').trim()
    if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')

    let nodes: Array<{ label: string; content: string }> = []
    try { nodes = JSON.parse(jsonText) } catch {}
    if (!Array.isArray(nodes) || !nodes.length) {
      // Heuristic fallback
      nodes = [
        { label: `Overview: ${topic}`, content: 'Summarize goals and scope.' },
        { label: 'Key Ideas', content: 'List 3–6 bullet points that capture the theme.' },
        { label: 'Plan & Steps', content: 'Provide a short step-by-step outline.' },
        { label: 'Resources', content: 'List tools, links, or references to consider.' },
        { label: 'Next Actions', content: 'Propose 3 immediate, concrete next steps.' },
      ].slice(0, max)
    }
    return NextResponse.json({ nodes })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


