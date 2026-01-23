import { NextResponse } from 'next/server'

type Density = 'low' | 'medium' | 'high'
type PlannedNode =
  | { type: 'text'; id?: string; title: string; content: string }
  | { type: 'image'; id?: string; title: string; query: string; content?: string }
  | { type: 'video'; id?: string; title: string; query: string; content?: string }

type PlannedChild = PlannedNode & { parentId?: string; parentTitle?: string }

type TextPlannedNode = Extract<PlannedNode, { type: 'text' }>
type ImagePlannedNode = Extract<PlannedNode, { type: 'image' }>
type VideoPlannedNode = Extract<PlannedNode, { type: 'video' }>

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
    existingNodes?: Array<{ title?: string; type?: string; contentSnippet?: string }>
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
  nodes: Array<{ id: string; type: 'text'; title: string; content: string }>
  children: Array<
    | { type: 'text'; title: string; content: string; parentId: string }
    | { type: 'image'; title: string; content?: string; imageUrl: string; parentId: string }
    | { type: 'video'; title: string; content?: string; videoUrl: string; parentId: string }
  >
}

async function callOpenAI(messages: any[], maxTokens = 900): Promise<{ ok: boolean; status: number; content?: string; error?: string }> {
  try {
    const gatewayKey = process.env.AI_GATEWAY_API_KEY || ''
    const useGateway = !!gatewayKey
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_SERVER
    if (!useGateway && !apiKey) return { ok: false, status: 500, error: 'Server AI key not configured' }

    const upstreamUrl = useGateway
      ? 'https://ai-gateway.vercel.sh/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const upstreamAuth = useGateway ? gatewayKey : apiKey
    const upstreamModel = useGateway ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'

    const resp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${upstreamAuth}` },
      body: JSON.stringify({
        model: upstreamModel,
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

function sanitizeSnippet(input: string, maxLen: number): string {
  const s = String(input || '')
    // strip URLs to reduce noise / avoid leaking link spam into the prompt
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen).trim() : s
}

function buildExistingNodesContext(existingNodes: Array<{ title?: string; type?: string; contentSnippet?: string }>): string {
  // Keep a predictable prompt budget: include short snippets for up to 20 nodes,
  // with a total cap across all snippets.
  const MAX_NODES_WITH_SNIPPETS = 20
  const SNIPPET_MAX_LEN = 300
  const TOTAL_SNIPPET_BUDGET = 8000

  const list = Array.isArray(existingNodes) ? existingNodes : []
  const lines: string[] = []
  let used = 0

  const take = list.slice(0, Math.max(0, MAX_NODES_WITH_SNIPPETS))
  for (const n of take) {
    const title = sanitizeSnippet(String(n?.title || ''), 80)
    const type = sanitizeSnippet(String(n?.type || ''), 24)
    const snippet = sanitizeSnippet(String(n?.contentSnippet || ''), SNIPPET_MAX_LEN)

    if (!title && !snippet) continue

    const head = `- [${type || 'node'}] ${title || 'Untitled'}`
    const tail = snippet ? ` — ${snippet}` : ''
    const line = `${head}${tail}`.trim()

    const addCost = line.length + 1
    if (used + addCost > TOTAL_SNIPPET_BUDGET) break
    used += addCost
    lines.push(line)
  }

  const omitted = Math.max(0, list.length - take.length)
  if (omitted > 0) {
    lines.push(`- … (+${omitted} more)`)
  }

  return lines.length ? lines.join('\n') : ''
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
    return { type: 'text', id: String(raw?.id || '').trim() || undefined, title, content: content || '' }
  }
  if (type === 'image') {
    const query = String(raw?.query || '').trim()
    return { type: 'image', id: String(raw?.id || '').trim() || undefined, title, query: query || title, content: content || '' }
  }
  if (type === 'video') {
    const query = String(raw?.query || '').trim()
    return { type: 'video', id: String(raw?.id || '').trim() || undefined, title, query: query || title, content: content || '' }
  }
  return null
}

function normalizePlannedChild(raw: any): PlannedChild | null {
  const base = normalizePlannedNode(raw)
  if (!base) return null
  const parentId = String(raw?.parentId || '').trim()
  const parentTitle = String(raw?.parentTitle || '').trim()
  return {
    ...(base as PlannedNode),
    parentId: parentId || undefined,
    parentTitle: parentTitle || undefined,
  }
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
      `- Total nodes (level 1 + level 2): ${effectiveTotalMin}–${effectiveTotalMax}`,
      `- Level 1 must include at least ${effectiveMinText} text nodes.`,
      `- Total media nodes (images+videos) across all levels: ${effectiveMinMedia}–${effectiveMaxMedia}.`,
      `- Images: 0–${maxImages}.`,
      `- Videos: 0–${maxVideos}.`,
      '',
      'Output JSON with this exact shape:',
      '{ "plan": { "density": "low|medium|high", "counts": { "text": number, "image": number, "video": number }, "rationale": string }, "nodes": [ { "id": string, "type":"text", "title": string, "content": string } ], "children": [ { "parentId": string, "type":"text|image|video", "title": string, "content": string, "query"?: string } ] }',
      '',
      'Rules:',
      '- Level 1 nodes MUST be text only and must include unique "id" fields.',
      '- Children must reference a valid parentId from level 1.',
      '- "query" is REQUIRED for image/video nodes and is a short search phrase (2–8 words). No URLs.',
      '- Avoid duplicating what is already on the board. Prefer filling gaps, adding complements, or going deeper.',
      '- If no explicit count is requested, fewer nodes is OK. Do not pad; prefer clarity over quantity.',
      '- Keep titles concise (<= 60 chars).',
      '- Content: 1–2 sentences max (short, actionable).',
      '- Ensure counts match combined nodes + children and obey guardrails.',
    ].join('\n')

    const existingContext = buildExistingNodesContext(existingNodes as any)
    const userPrompt = [
      `Mode: ${mode}`,
      `Board topic: ${topic}`,
      goal ? `Board goal: ${goal}` : '',
      existingContext ? `Existing nodes (do not duplicate; titles + snippets):\n${existingContext}` : 'Existing nodes: []',
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
    const plannedChildrenRaw: any[] = Array.isArray(parsed?.children) ? parsed.children : []
    const plannedNodes: PlannedNode[] = plannedNodesRaw.map(normalizePlannedNode).filter(Boolean) as any
    const plannedChildren: PlannedChild[] = plannedChildrenRaw.map(normalizePlannedChild).filter(Boolean) as any

    // Enforce guardrails for level-1 text nodes
    const texts: TextPlannedNode[] = plannedNodes.filter((n): n is TextPlannedNode => n.type === 'text')
    let safeText = texts
    if (safeText.length < effectiveMinText) {
      const need = effectiveMinText - safeText.length
      const fillers: TextPlannedNode[] = Array.from({ length: need }).map((_, i) => ({
        type: 'text',
        title: `Key Point ${safeText.length + i + 1}`,
        content: 'Add a concise, actionable detail here.',
      }))
      safeText = [...safeText, ...fillers]
    }

    let childImages: ImagePlannedNode[] = plannedChildren.filter((n): n is ImagePlannedNode => n.type === 'image').slice(0, maxImages)
    let childVideos: VideoPlannedNode[] = plannedChildren.filter((n): n is VideoPlannedNode => n.type === 'video').slice(0, maxVideos)
    const childTexts: TextPlannedNode[] = plannedChildren.filter((n): n is TextPlannedNode => n.type === 'text')

    if (safeText.length === 0 && plannedChildren.length > 0) {
      safeText = [{
        type: 'text',
        id: 'n1',
        title: `Overview: ${topic}`,
        content: 'High-level overview of the topic.',
      }]
    }

    safeText = safeText.map((n, i) => ({ ...n, id: n.id || `n${i + 1}` }))
    const parentIds = safeText.map(n => n.id || '').filter(Boolean)
    const fallbackParentId = parentIds[0] || 'n1'

    // Ensure media count within bounds (minMedia..maxMedia), allowing any mix.
    const mediaSupported = supported.includes('image') || supported.includes('video')
    if (mediaSupported) {
      const mediaNow = childImages.length + childVideos.length
      const cap = effectiveTotalMax
      const targetMinMedia = clamp(effectiveMinMedia, 0, cap)
      const targetMaxMedia = clamp(effectiveMaxMedia, targetMinMedia, cap)

      if (mediaNow < targetMinMedia) {
        let need = targetMinMedia - mediaNow
        while (need > 0 && (childImages.length < maxImages || childVideos.length < maxVideos)) {
          if (supported.includes('image') && childImages.length < maxImages) {
            childImages = [...childImages, { type: 'image', title: `Image reference`, query: topic, content: '' }]
            need--
            continue
          }
          if (supported.includes('video') && childVideos.length < maxVideos) {
            childVideos = [...childVideos, { type: 'video', title: `Video reference`, query: topic, content: '' }]
            need--
            continue
          }
          break
        }
      }

      const mediaAfterAdd = childImages.length + childVideos.length
      if (mediaAfterAdd > targetMaxMedia) {
        let extra = mediaAfterAdd - targetMaxMedia
        while (extra > 0 && childVideos.length > 0) { childVideos = childVideos.slice(0, -1); extra-- }
        while (extra > 0 && childImages.length > 0) { childImages = childImages.slice(0, -1); extra-- }
      }
    }

    let childCombined: PlannedChild[] = [...childTexts, ...childImages, ...childVideos]
    const totalCombinedCount = safeText.length + childCombined.length
    if (totalCombinedCount < effectiveTotalMin) {
      const need = effectiveTotalMin - totalCombinedCount
      const fillers: PlannedChild[] = Array.from({ length: need }).map((_, i) => ({
        type: 'text',
        title: `Next Step ${i + 1}`,
        content: 'Add a short helpful note.',
        parentId: fallbackParentId,
      }))
      childCombined = [...childCombined, ...fillers]
    }
    const maxChildren = Math.max(0, effectiveTotalMax - safeText.length)
    if (childCombined.length > maxChildren) {
      childCombined = childCombined.slice(0, maxChildren)
    }

    const outNodes: GenerateResponse['nodes'] = safeText.map((n, i) => ({
      id: String(n.id || `n${i + 1}`),
      type: 'text',
      title: n.title,
      content: n.content || '',
    }))

    const outChildren: GenerateResponse['children'] = []
    for (const n of childCombined) {
      const parentId = String((n as any)?.parentId || '').trim()
      const parentTitle = String((n as any)?.parentTitle || '').trim()
      const resolvedParentId = parentId && parentIds.includes(parentId)
        ? parentId
        : (parentTitle ? (outNodes.find(p => p.title.toLowerCase() === parentTitle.toLowerCase())?.id || '') : '') || fallbackParentId

      if (n.type === 'text') {
        outChildren.push({ type: 'text', title: n.title, content: n.content || '', parentId: resolvedParentId })
        continue
      }
      if (n.type === 'image') {
        const q = (n.query || n.title || topic).trim()
        const img = (await searchUnsplashImage(q)) || toUnsplashSourceUrl(q)
        outChildren.push({ type: 'image', title: n.title, content: n.content || '', imageUrl: img, parentId: resolvedParentId })
        continue
      }
      if (n.type === 'video') {
        const q = (n.query || n.title || topic).trim()
        const yt = await searchYouTubeEmbeddableVideos({ query: `${topic} ${q}`, maxVideos: 1 })
        const pick = yt?.[0]?.id ? buildYouTubeWatchUrl(yt[0].id) : ''
        if (!pick) continue
        outChildren.push({ type: 'video', title: n.title, content: n.content || '', videoUrl: pick, parentId: resolvedParentId })
      }
    }

    const counts = {
      text: outNodes.length + outChildren.filter(n => n.type === 'text').length,
      image: outChildren.filter(n => n.type === 'image').length,
      video: outChildren.filter(n => n.type === 'video').length,
    }

    const plan = {
      density,
      counts,
      rationale: String(parsed?.plan?.rationale || '').trim() || 'Planned a balanced mix of text backbone with supporting media.',
    }

    const response: GenerateResponse = { plan, nodes: outNodes, children: outChildren }
    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

