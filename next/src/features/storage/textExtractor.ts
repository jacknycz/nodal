// Remove the top-level imports that cause SSR issues
// import * as pdfjsLib from 'pdfjs-dist'
// import mammoth from 'mammoth'

/**
 * Extract text from PDF files using PDF.js (dynamic import)
 */
export async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    // Client-side fallback: PDF.js in browser with worker
    try {
      const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
      try {
        if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
      } catch {}
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      let combined = ''
      const maxPages = Math.min(pdf.numPages || 0, 50)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = (textContent.items || [])
          .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
          .join(' ')
        if (pageText && pageText.trim()) combined += (combined ? '\n\n' : '') + pageText.trim()
      }
      return combined.replace(/\s+/g, ' ').trim()
    } catch {}

    return ''
  } catch (error) {
    console.error('❌ PDF text extraction failed:', error)
    return ''
  }
}

/**
 * Extract text from Word documents (.docx) using mammoth.js (dynamic import)
 */
export async function extractTextFromWord(file: Blob): Promise<string> {
  try {
    console.log('📝 Starting Word document text extraction...')
    
    // Dynamic import to avoid SSR issues
    const mammoth = await import('mammoth')
    
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.default.extractRawText({ arrayBuffer })
    
    if (result.messages.length > 0) {
      console.log('⚠️ Mammoth warnings:', result.messages)
    }
    
    const text = result.value.trim()
    console.log(`🎉 Word extraction complete! Total: ${text.length} characters`)
    return text
    
  } catch (error) {
    console.error('❌ Word document text extraction failed:', error)
    return `Word document text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Extract text from any supported file type
 */
export async function extractTextFromFile(file: Blob, fileType: string, fileName: string): Promise<string> {
  const normalizedType = fileType.toLowerCase()
  const normalizedName = fileName.toLowerCase()
  
  console.log(`🔍 Extracting text from: ${fileName} (${fileType})`)
  
  try {
    // PDF files - temporarily simplified
    if (normalizedType.includes('pdf')) {
      return await extractTextFromPDF(file)
    }
    
    // Word documents
    if (normalizedType.includes('word') || 
        normalizedType.includes('document') || 
        normalizedName.endsWith('.docx') || 
        normalizedName.endsWith('.doc')) {
      return await extractTextFromWord(file)
    }
    
    // Text files - read directly
    if (normalizedType.includes('text/') || 
        normalizedType.includes('json') || 
        normalizedType.includes('markdown') ||
        normalizedName.endsWith('.txt') ||
        normalizedName.endsWith('.md') ||
        normalizedName.endsWith('.json')) {
      const text = await file.text()
      console.log(`📝 Text file read directly: ${text.length} characters`)
      return text
    }
    
    // Unsupported file type
    console.log(`⚠️ No text extraction available for: ${fileType}`)
    return `File uploaded successfully: ${fileName}

No text extraction available for file type: ${fileType}
File size: ${(file.size / 1024).toFixed(1)} KB`
    
  } catch (error) {
    console.error('❌ Text extraction failed:', error)
    return `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Quick validation if a file type supports text extraction
 */
export function isTextExtractable(fileType: string, fileName: string): boolean {
  const normalizedType = fileType.toLowerCase()
  const normalizedName = fileName.toLowerCase()
  
  return (
    normalizedType.includes('pdf') ||
    normalizedType.includes('word') ||
    normalizedType.includes('document') ||
    normalizedType.includes('text/') ||
    normalizedType.includes('json') ||
    normalizedType.includes('markdown') ||
    normalizedName.endsWith('.docx') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.txt') ||
    normalizedName.endsWith('.md') ||
    normalizedName.endsWith('.json')
  )
} 