import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { signedUrl?: string; fileName?: string; fileType?: string }
    const { signedUrl } = body || {}

    if (!signedUrl || typeof signedUrl !== 'string') {
      return NextResponse.json({ extractedText: '' }, { status: 200 })
    }

    const res = await fetch(signedUrl, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ extractedText: '' }, { status: 200 })
    }

    const arrayBuffer = await res.arrayBuffer()
    let extractedText = ''
    try {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
      const buffer = Buffer.from(arrayBuffer)
      const result = await pdfParse(buffer)
      extractedText = String(result?.text || '').trim()
    } catch {
      extractedText = ''
    }

    return NextResponse.json({ extractedText }, { status: 200 })
  } catch {
    return NextResponse.json({ extractedText: '' }, { status: 200 })
  }
}
