import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { signedUrl, fileName, fileType } = body as { signedUrl: string; fileName: string; fileType: string }

    if (!signedUrl || !fileType) {
      return NextResponse.json({ error: 'Missing signedUrl or fileType' }, { status: 400 })
    }

    const res = await fetch(signedUrl)
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to download file (${res.status})` }, { status: 500 })
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedText = ''

    if (fileType.includes('pdf')) {
      // Use ESM-compatible entry to avoid odd default behavior
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
      const result = await pdfParse(buffer)
      extractedText = result.text?.trim() || ''
    } else if (fileType.startsWith('text/') || fileType.includes('json') || fileType.includes('markdown')) {
      extractedText = buffer.toString('utf-8')
    } else {
      extractedText = ''
    }

    return NextResponse.json({
      success: true,
      extractedText,
      characterCount: extractedText.length,
      fileName,
      fileType,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}


