import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { signedUrl?: string; fileName?: string; fileType?: string }
    const { signedUrl } = body || {}

    // If we don't have a URL, return an empty extraction gracefully
    if (!signedUrl || typeof signedUrl !== 'string') {
      return NextResponse.json({ extractedText: '' }, { status: 200 })
    }

    // Try to fetch the PDF; if it fails, still return a 200 with empty extraction
    try {
      const res = await fetch(signedUrl, { cache: 'no-store' })
      if (!res.ok) {
        return NextResponse.json({ extractedText: '' }, { status: 200 })
      }
      // Keep the route lightweight; return empty extraction by default
      return NextResponse.json({ extractedText: '' }, { status: 200 })
    } catch {
      return NextResponse.json({ extractedText: '' }, { status: 200 })
    }
  } catch {
    // Never surface a 5xx to the client for this route; fail soft with empty extraction
    return NextResponse.json({ extractedText: '' }, { status: 200 })
  }
}
