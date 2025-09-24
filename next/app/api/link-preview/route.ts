import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const target = url.searchParams.get('url')
    if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Validate URL and ensure http/https only
    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
    }

    // Fetch the page HTML server-side
    const resp = await fetch(parsed.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 NodalBot' } })
    if (!resp.ok) return NextResponse.json({ error: `Fetch failed (${resp.status})` }, { status: 400 })
    const html = await resp.text()

    // Naive extraction of Open Graph/meta and first image
    const og = {
      title: matchMeta(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i),
      description: matchMeta(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i),
      image: absoluteUrl(target, matchMeta(html, /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)),
    }
    const titleTag = matchMeta(html, /<title>([\s\S]*?)<\/title>/i)
    const firstImgRel = matchMeta(html, /<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    const firstImage = absoluteUrl(target, firstImgRel)
    const faviconRel = matchLinkRelIcon(html)
    const favicon = faviconRel ? absoluteUrl(target, faviconRel) : googleFavicon(target)

    return NextResponse.json({
      title: og.title || titleTag || null,
      description: og.description || null,
      image: og.image || null,
      firstImage: firstImage || null,
      favicon: favicon || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

function matchMeta(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m?.[1]?.trim() || null
}

function absoluteUrl(base: string, rel: string | null): string | null {
  if (!rel) return null
  try {
    return new URL(rel, base).toString()
  } catch {
    return null
  }
}

function matchLinkRelIcon(html: string): string | null {
  const re = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i
  const m = html.match(re)
  return m?.[1]?.trim() || null
}

function googleFavicon(pageUrl: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(pageUrl)}`
  } catch {
    return null
  }
}


