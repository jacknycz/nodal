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
    let errorMessage = ''

    if (fileType.includes('pdf')) {
      try {
        // Primary: pdf-parse
        const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
        const result = await pdfParse(buffer)
        extractedText = result.text?.trim() || ''
      } catch (e) {
        errorMessage = `pdf-parse failed: ${e instanceof Error ? e.message : 'unknown error'}`
        // Fallback: pdfjs-dist text extraction
        try {
          const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
          const loadingTask = pdfjsLib.getDocument({ data: buffer })
          const pdf = await loadingTask.promise
          let combined = ''
          const maxPages = Math.min(pdf.numPages || 0, 50)
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i)
            const tc = await page.getTextContent()
            const pageText = (tc.items || [])
              .map((it: any) => (it && typeof it.str === 'string' ? it.str : ''))
              .join(' ')
            combined += (combined ? '\n\n' : '') + pageText
          }
          extractedText = combined.trim()
        } catch (e2) {
          errorMessage += ` | pdfjs-dist failed: ${e2 instanceof Error ? e2.message : 'unknown error'}`
        }
      }
    } else if (fileType.startsWith('text/') || fileType.includes('json') || fileType.includes('markdown')) {
      extractedText = buffer.toString('utf-8')
    } else {
      extractedText = ''
    }

    return NextResponse.json({
      success: extractedText.length > 0,
      extractedText,
      characterCount: extractedText.length,
      fileName,
      fileType,
      error: extractedText.length > 0 ? undefined : errorMessage || undefined,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}


