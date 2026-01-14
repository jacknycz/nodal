import { NextResponse } from 'next/server'

type MediaNode = { type: 'image' | 'video'; title: string; url: string; content?: string }
type GenerateRequest = { topic: string; description?: string; maxImages?: number; maxVideos?: number }

async function callOpenAI(messages: any[], maxTokens = 500): Promise<{ ok: boolean; status: number; content?: string; totalTokens?: number; error?: string }> {
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

function toUnsplashSourceUrl(query: string): string {
  // Always returns a valid image response (via redirect), no API key needed
  return `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`
}

async function searchUnsplashImage(query: string): Promise<string | null> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
    if (!accessKey) return null
    const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`
    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
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

async function searchYouTubeEmbeddableVideos(params: {
  query: string
  maxVideos: number
}): Promise<Array<{ id: string; title: string }>> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) return []

    const q = (params.query || '').trim()
    const maxVideos = Math.max(0, Math.min(Number(params.maxVideos || 0), 5))
    if (!q || maxVideos <= 0) return []

    // Keep quota use reasonable:
    // - search.list costs 100 units/call, so we do ONE search call.
    // - videos.list costs 1 unit/call.
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
      ? searchJson.items
          .map((it: any) => String(it?.id?.videoId || '').trim())
          .filter((v: string) => !!v)
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
      .map((it: any) => ({
        id: String(it?.id || '').trim(),
        title: String(it?.snippet?.title || '').trim(),
      }))
      .filter((it: any) => !!it.id)

    return ok.slice(0, maxVideos)
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest
    const topic = String((body as any)?.topic || '').trim()
    const desc = String((body as any)?.description || '').trim()
    const maxImages = Math.max(0, Math.min(Number((body as any)?.maxImages ?? 2) || 2, 5))
    const maxVideos = Math.max(0, Math.min(Number((body as any)?.maxVideos ?? 2) || 2, 5))

    if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 })

    // Ask for *queries* for images (we resolve via Unsplash API if key available) and *queries* for videos (we resolve via YouTube Data API).
    const prompt = [
      `Board topic: "${topic}".`,
      desc ? `Board description: "${desc}".` : '',
      `Generate ${maxImages} image ideas and ${maxVideos} video link ideas that would be helpful for this board.`,
      'Return ONLY JSON with shape:',
      '{ "images": [{ "title": string, "query": string, "content": string }], "videos": [{ "title": string, "query": string, "content": string }] }',
      'Rules:',
      '- image.query should be 2-6 words, no quotes.',
      '- videos.query should be 2-8 words describing what to search on YouTube. No URLs.',
      '- content should be 1 short sentence explaining why it is useful.',
    ].filter(Boolean).join('\n')
    const systemPrompt = 'You return strictly JSON with no markdown fences.'
    const ai = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], 650)
    if (!ai.ok) return NextResponse.json({ error: ai.error || 'AI error' }, { status: ai.status })

    let jsonText = (ai.content || '').trim()
    if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')

    let parsed: any = null
    try { parsed = JSON.parse(jsonText) } catch {}
    const imagesIn: any[] = Array.isArray(parsed?.images) ? parsed.images : []
    const videosIn: any[] = Array.isArray(parsed?.videos) ? parsed.videos : []

    const nodes: MediaNode[] = []

    // Images
    for (const it of imagesIn.slice(0, maxImages)) {
      const title = String(it?.title || 'Image').trim() || 'Image'
      const query = String(it?.query || topic).trim() || topic
      const content = String(it?.content || '').trim()
      const fromApi = await searchUnsplashImage(query)
      nodes.push({ type: 'image', title, url: fromApi || toUnsplashSourceUrl(query), content })
    }

    // Videos (YouTube-only): resolve to real, embeddable, public videos via YouTube Data API v3
    const videoIdeas = videosIn.slice(0, maxVideos).map((it: any) => ({
      title: String(it?.title || 'Video').trim() || 'Video',
      query: String(it?.query || '').trim(),
      content: String(it?.content || '').trim(),
    }))
    const combinedQuery = [
      topic,
      desc ? desc.split(/\s+/).slice(0, 16).join(' ') : '',
      ...videoIdeas.map(v => v.query).filter(Boolean)
    ].filter(Boolean).join(' ')
    let yt = await searchYouTubeEmbeddableVideos({ query: combinedQuery, maxVideos })
    if ((!yt || yt.length === 0) && topic) {
      // If combined query is too specific (or we got no embeddable results), fall back to topic-only search.
      yt = await searchYouTubeEmbeddableVideos({ query: topic, maxVideos })
    }

    for (let i = 0; i < yt.length; i++) {
      const idea = videoIdeas[i] || { title: yt[i].title || 'Video', query: '', content: '' }
      nodes.push({
        type: 'video',
        title: idea.title || yt[i].title || 'Video',
        url: buildYouTubeWatchUrl(yt[i].id),
        content: idea.content,
      })
    }

    // If YouTube key is missing, quota is exhausted, or we got no embeddable results,
    // return fewer videos rather than shipping broken/blocked embeds.

    const debug = process.env.NODE_ENV !== 'production'
      ? {
          hasYouTubeKey: !!process.env.YOUTUBE_API_KEY,
          hasYouTubeKeyPublicFallback: !!process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
          usedQuery: combinedQuery,
          requestedVideos: maxVideos,
          returnedVideos: yt.length,
        }
      : undefined

    return NextResponse.json({ nodes, ...(debug ? { debug } : {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

