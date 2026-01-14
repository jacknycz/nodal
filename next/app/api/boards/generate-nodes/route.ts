import { NextResponse } from 'next/server'

type Density = 'low' | 'medium' | 'high'
type PlannedNode =
  | { type: 'text'; title: string; content: string }
  | { type: 'image'; title: string; query: string; content?: string }
  | { type: 'video'; title: string; query: string; content?: string }

type CountIntent = { n: number; reason: string } | null

type GenerateRequest = {
  topic: string
  goal?: string
  mode?: 'board_create' | 'quick_generate'
  density?: Density
  constraints?: {
    totalMin?: number
    totalMax?: number
    minText?: number
    minMedia?: number
    maxMedia?: number
    maxImages?: number
    maxVideos?: number
  }
  board?: {
    supportedNodeTypes?: Array<'text' | 'image' | 'video'>
    existingNodes?: Array<{ title?: string; type?: string }>
  }
  selected?: {
    title?: string
    content?: string
  }
}

type GenerateResponse = {
  plan: {
    density: Density
    counts: { text: number; image: number; video: number }
    rationale: string
  }
  nodes: Array<
    | { type: 'text'; title: string; content: string }
    | { type: 'image'; title: string; content?: string; imageUrl: string }
    | { type: 'video'; title: string; content?: string; videoUrl: string }
  >
}

async function callOpenAI(messages: any[], maxTokens = 900): Promise<{ ok: boolean; status: number; content?: string; error?: string }> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_SERVER
    if (!apiKey) return { ok: false, status: 500, error: 'Server AI key not configured' }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: maxTokens,
        stream: false,
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return { ok: false, status: resp.status, error: err?.error?.message || resp.statusText }
    }
    const data = await resp.json()
    return { ok: true, status: 200, content: data?.choices?.[0]?.message?.content || '' }
  } catch (e: any) {
    return { ok: false, status: 500, error: e?.message || 'Unknown error' }
  }
}

function stripJsonFences(text: string): string {
  let t = (text || '').trim()
  if (t.startsWith('```json')) t = t.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  else if (t.startsWith('```')) t = t.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  return t.trim()
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function extractRequestedCount(text: string): CountIntent {
  const t = String(text || '').toLowerCase()
  const patterns: Array<{ re: RegExp; reason: string }> = [
    { re: /\btop\s+(\d{1,2})\b/i, reason: 'top_n' },
    { re: /\b(\d{1,2})\s+(steps?|ways?|examples?|players?|items?|ideas?|tips?|things?)\b/i, reason: 'n_list' },
  ]
  for (const p of patterns) {
    const m = t.match(p.re)
    if (m && m[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 1 && n <= 20) return { n, reason: p.reason }
    }
  }
  return null
}

function toUnsplashSourceUrl(query: string): string {
  return `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`
}

async function searchUnsplashImage(query: string): Promise<string | null> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
    if (!accessKey) return null
    const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`
    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
    })
    if (!resp.ok) return null
    const json: any = await resp.json().catch(() => null)
    const first = json?.results?.[0]
    const chosen = first?.urls?.regular || first?.urls?.full || first?.urls?.small
    return typeof chosen === 'string' && chosen.trim() ? chosen.trim() : null
  } catch {
    return null
  }
}

function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

async function searchYouTubeEmbeddableVideos(params: { query: string; maxVideos: number }): Promise<Array<{ id: string; title: string }>> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) return []
    const q = (params.query || '').trim()
    const maxVideos = clamp(Number(params.maxVideos || 0), 0, 5)
    if (!q || maxVideos <= 0) return []

    const searchMax = Math.max(5, Math.min(maxVideos * 8, 25))
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('q', q)
    searchUrl.searchParams.set('maxResults', String(searchMax))
    searchUrl.searchParams.set('safeSearch', 'strict')
    searchUrl.searchParams.set('videoEmbeddable', 'true')
    searchUrl.searchParams.set('videoSyndicated', 'true')
    searchUrl.searchParams.set('key', apiKey)

    const searchResp = await fetch(searchUrl.toString(), { method: 'GET' })
    if (!searchResp.ok) return []
    const searchJson: any = await searchResp.json().catch(() => null)
    const ids: string[] = Array.isArray(searchJson?.items)
      ? searchJson.items.map((it: any) => String(it?.id?.videoId || '').trim()).filter((v: string) => !!v)
      : []
    const uniqueIds = Array.from(new Set(ids)).slice(0, 50)
    if (!uniqueIds.length) return []

    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videosUrl.searchParams.set('part', 'status,snippet')
    videosUrl.searchParams.set('id', uniqueIds.join(','))
    videosUrl.searchParams.set('key', apiKey)
    const videosResp = await fetch(videosUrl.toString(), { method: 'GET' })
    if (!videosResp.ok) return []
    const videosJson: any = await videosResp.json().catch(() => null)
    const items: any[] = Array.isArray(videosJson?.items) ? videosJson.items : []

    const ok = items
      .filter((it: any) => it?.status?.embeddable === true && String(it?.status?.privacyStatus || '') === 'public')
      .map((it: any) => ({ id: String(it?.id || '').trim(), title: String(it?.snippet?.title || '').trim() }))
      .filter((it: any) => !!it.id)

    return ok.slice(0, maxVideos)
  } catch {
    return []
  }
}

function normalizePlannedNode(raw: any): PlannedNode | null {
  const type = String(raw?.type || '').trim().toLowerCase()
  const title = String(raw?.title || '').trim()
  const content = String(raw?.content || '').trim()
  if (!title) return null
  if (type === 'text') {
    return { type: 'text', title, content: content || '' }
  }
  if (type === 'image') {
    const query = String(raw?.query || '').trim()
    return { type: 'image', title, query: query || title, content: content || '' }
  }
  if (type === 'video') {
    const query = String(raw?.query || '').trim()
    return { type: 'video', title, query: query || title, content: content || '' }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest
    const topic = String(body?.topic || '').trim()
    if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 })

    const density: Density = (body?.density === 'low' || body?.density === 'high') ? body.density : 'medium'
    const c = body?.constraints || {}
    const totalMin = clamp(Number(c.totalMin ?? 4), 1, 50)
    const totalMax = clamp(Number(c.totalMax ?? 16), totalMin, 50)
    // Default to at least 1 text node so the board has a "backbone" unless caller overrides.
    const minText = clamp(Number(c.minText ?? 1), 0, totalMax)
    const minMedia = clamp(Number(c.minMedia ?? 1), 0, totalMax)
    const maxMedia = clamp(Number(c.maxMedia ?? 4), minMedia, totalMax)
    const maxImages = clamp(Number(c.maxImages ?? 3), 0, 10)
    const maxVideos = clamp(Number(c.maxVideos ?? 2), 0, 10)
    const goal = String(body?.goal || '').trim()

    const supported = Array.isArray(body?.board?.supportedNodeTypes) && body.board?.supportedNodeTypes?.length
      ? body.board.supportedNodeTypes
      : (['text', 'image', 'video'] as const)

    const existingNodes = Array.isArray(body?.board?.existingNodes) ? body.board!.existingNodes!.slice(0, 30) : []
    const selectedTitle = String(body?.selected?.title || '').trim()
    const selectedContent = String(body?.selected?.content || '').trim()
    const mode = body?.mode || 'quick_generate'

    // Honor explicit counts like "Top 10", "10 steps", etc. up to 20.
    // When present, we clamp the total to N (within 1..20) so the model can fulfill the list cleanly.
    const requestedCount = extractRequestedCount([topic, goal, selectedTitle, selectedContent].filter(Boolean).join('\n'))?.n ?? null
    // If the request is "Top N" etc (N <= 20), we honor N by requiring at least N text nodes.
    // Total nodes may exceed 20 slightly when media is enabled (since media is "supporting" and counted separately).
    const effectiveTotalMax = requestedCount ? clamp(Math.max(totalMax, requestedCount + minMedia), 1, 50) : totalMax
    const effectiveMinMedia = minMedia
    const effectiveTotalMin = requestedCount
      ? clamp(Math.max(totalMin, requestedCount + effectiveMinMedia), 1, effectiveTotalMax)
      : totalMin
    const effectiveMinText = clamp(Math.max(minText, requestedCount || 0), 0, effectiveTotalMax)
    const effectiveMaxMedia = clamp(maxMedia, effectiveMinMedia, effectiveTotalMax)

    const systemPrompt = [
      'You are Nodal’s node generation planner.',
      'You must plan first, then output STRICT JSON (no markdown fences).',
      '',
      'You may ONLY output node types that are supported.',
      'Supported node types: ' + JSON.stringify(supported),
      '',
      'Guardrails:',
      requestedCount ? `- Explicit count requested: ${requestedCount} (honor it up to 20 text items).` : '',
      `- Total nodes: ${effectiveTotalMin}–${effectiveTotalMax}`,
      `- At least ${effectiveMinText} text nodes.`,
      `- Total media nodes (images+videos): ${effectiveMinMedia}–${effectiveMaxMedia}.`,
      `- Images: 0–${maxImages}.`,
      `- Videos: 0–${maxVideos}.`,
      '',
      'Output JSON with this exact shape:',
      '{ "plan": { "density": "low|medium|high", "counts": { "text": number, "image": number, "video": number }, "rationale": string }, "nodes": [ { "type":"text|image|video", "title": string, "content": string, "query"?: string } ] }',
      '',
      'Rules:',
      '- "query" is REQUIRED for image/video nodes and is a short search phrase (2–8 words). No URLs.',
      '- If no explicit count is requested, fewer nodes is OK. Do not pad; prefer clarity over quantity.',
      '- Keep titles concise (<= 60 chars).',
      '- Content: 1–2 sentences max (short, actionable).',
      '- Ensure counts match nodes length and obey guardrails.',
    ].join('\n')

    const userPrompt = [
      `Mode: ${mode}`,
      `Board topic: ${topic}`,
      goal ? `Board goal: ${goal}` : '',
      existingNodes.length ? `Existing nodes (title + type): ${JSON.stringify(existingNodes)}` : 'Existing nodes: []',
      selectedTitle ? `Selected node title: ${selectedTitle}` : '',
      selectedContent ? `Selected node context (may be long): ${selectedContent.slice(0, 1400)}` : '',
      '',
      `Density preference: ${density} (low=fewer nodes, high=more nodes within bounds).`,
      'Now generate the plan and node list.',
    ].filter(Boolean).join('\n')

    const ai = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 1100)
    if (!ai.ok) return NextResponse.json({ error: ai.error || 'AI error' }, { status: ai.status })

    let parsed: any = null
    try { parsed = JSON.parse(stripJsonFences(ai.content || '')) } catch {}
    const plannedNodesRaw: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : []
    const plannedNodes: PlannedNode[] = plannedNodesRaw.map(normalizePlannedNode).filter(Boolean) as any

    // Enforce guardrails in code (clamp + trim)
    const texts = plannedNodes.filter(n => n.type === 'text')
    let images = plannedNodes.filter(n => n.type === 'image').slice(0, maxImages)
    let videos = plannedNodes.filter(n => n.type === 'video').slice(0, maxVideos)

    let safeText = texts
    if (safeText.length < effectiveMinText) {
      // add simple filler text nodes (rare, but ensures backbone)
      const need = effectiveMinText - safeText.length
      const fillers: PlannedNode[] = Array.from({ length: need }).map((_, i) => ({
        type: 'text',
        title: `Key Point ${safeText.length + i + 1}`,
        content: 'Add a concise, actionable detail here.',
      }))
      safeText = [...safeText, ...fillers]
    }

    // Ensure media count within bounds (minMedia..maxMedia), allowing any mix.
    const mediaSupported = supported.includes('image') || supported.includes('video')
    if (mediaSupported) {
      const mediaNow = images.length + videos.length
      const cap = effectiveTotalMax
      const targetMinMedia = clamp(effectiveMinMedia, 0, cap)
      const targetMaxMedia = clamp(effectiveMaxMedia, targetMinMedia, cap)

      // Add media if under minMedia (prefer images because they rarely fail to resolve)
      const canAddImages = supported.includes('image') && images.length < maxImages
      const canAddVideos = supported.includes('video') && videos.length < maxVideos
      if (mediaNow < targetMinMedia && (canAddImages || canAddVideos)) {
        let need = targetMinMedia - mediaNow
        while (need > 0 && (images.length < maxImages || videos.length < maxVideos)) {
          if (supported.includes('image') && images.length < maxImages) {
            images = [...images, { type: 'image', title: `Image reference`, query: topic, content: '' }]
            need--
            continue
          }
          if (supported.includes('video') && videos.length < maxVideos) {
            videos = [...videos, { type: 'video', title: `Video reference`, query: topic, content: '' }]
            need--
            continue
          }
          break
        }
      }

      // Trim media if over maxMedia (drop from the end, preserve earlier picks)
      const mediaAfterAdd = images.length + videos.length
      if (mediaAfterAdd > targetMaxMedia) {
        let extra = mediaAfterAdd - targetMaxMedia
        // Trim videos first (harder to resolve), then images
        while (extra > 0 && videos.length > 0) { videos = videos.slice(0, -1); extra-- }
        while (extra > 0 && images.length > 0) { images = images.slice(0, -1); extra-- }
      }
    }

    let combined: PlannedNode[] = [...safeText, ...images, ...videos]
    combined = combined.slice(0, effectiveTotalMax)
    if (combined.length < effectiveTotalMin) {
      const need = effectiveTotalMin - combined.length
      const fillers: PlannedNode[] = Array.from({ length: need }).map((_, i) => ({
        type: 'text',
        title: `Starter ${combined.length + i + 1}`,
        content: 'Add a short helpful note.',
      }))
      combined = [...combined, ...fillers].slice(0, effectiveTotalMax)
    }

    // Resolve media
    const outNodes: GenerateResponse['nodes'] = []
    for (const n of combined) {
      if (n.type === 'text') {
        outNodes.push({ type: 'text', title: n.title, content: n.content || '' })
        continue
      }
      if (n.type === 'image') {
        const q = (n.query || n.title || topic).trim()
        const img = (await searchUnsplashImage(q)) || toUnsplashSourceUrl(q)
        outNodes.push({ type: 'image', title: n.title, content: n.content || '', imageUrl: img })
        continue
      }
      if (n.type === 'video') {
        const q = (n.query || n.title || topic).trim()
        const yt = await searchYouTubeEmbeddableVideos({ query: `${topic} ${q}`, maxVideos: 1 })
        const pick = yt?.[0]?.id ? buildYouTubeWatchUrl(yt[0].id) : ''
        // If we can't resolve a working video, skip it (never return broken videos)
        if (!pick) continue
        outNodes.push({ type: 'video', title: n.title, content: n.content || '', videoUrl: pick })
      }
    }

    const counts = {
      text: outNodes.filter(n => n.type === 'text').length,
      image: outNodes.filter(n => n.type === 'image').length,
      video: outNodes.filter(n => n.type === 'video').length,
    }

    const plan = {
      density,
      counts,
      rationale: String(parsed?.plan?.rationale || '').trim() || 'Planned a balanced mix of text backbone with supporting media.',
    }

    const response: GenerateResponse = { plan, nodes: outNodes }
    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

