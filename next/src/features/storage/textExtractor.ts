import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Set up PDF.js worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

/**
 * Extract text from PDF files using PDF.js
 */
export async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    console.log('📄 Starting PDF text extraction...')
    
    // Convert Blob to ArrayBuffer
    console.log('🔄 Converting file to ArrayBuffer...')
    const arrayBuffer = await file.arrayBuffer()
    console.log(`✅ ArrayBuffer created: ${arrayBuffer.byteLength} bytes`)
    
    // Try to use PDF.js without worker first
    try {
      // Load PDF document with simplified configuration
      console.log('🔄 Loading PDF document...')
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Clean configuration for reliable processing
        disableAutoFetch: true,
        disableStream: true,
        // Add CORS settings for CDN worker
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      })
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF loading timeout after 30 seconds')), 30000)
      })
      
      const pdf = await Promise.race([loadingTask.promise, timeoutPromise])
      console.log(`📊 PDF loaded successfully with ${pdf.numPages} pages`)
      
      const textParts: string[] = []
      
      // Extract text from each page with individual timeouts
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`🔄 Processing page ${pageNum}/${pdf.numPages}...`)
        
        try {
          const pageTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Page ${pageNum} timeout after 10 seconds`)), 10000)
          })
          
          const page = await Promise.race([pdf.getPage(pageNum), pageTimeoutPromise])
          console.log(`📄 Page ${pageNum} loaded, getting text content...`)
          
          const textContent = await Promise.race([page.getTextContent(), pageTimeoutPromise])
          console.log(`📝 Text content retrieved for page ${pageNum}`)
          
          // Combine text items from the page
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim()
          
          if (pageText) {
            textParts.push(`--- Page ${pageNum} ---\n${pageText}`)
          }
          
          console.log(`✅ Extracted text from page ${pageNum} (${pageText.length} chars)`)
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError)
          textParts.push(`--- Page ${pageNum} ---\n[Error extracting text from this page]`)
        }
      }
      
      const fullText = textParts.join('\n\n')
      console.log(`🎉 PDF extraction complete! Total: ${fullText.length} characters`)
      
      if (fullText.length === 0) {
        console.warn('⚠️ No text was extracted from PDF')
        return ''
      }
      
      return fullText
      
    } catch (pdfError) {
      console.error('❌ PDF.js processing failed:', pdfError)
      throw pdfError
    }
    
  } catch (error) {
    console.error('❌ PDF text extraction failed:', error)
    
    // Try alternative approach if worker fails
    if (error instanceof Error && (error.message.includes('worker') || error.message.includes('fetch'))) {
      console.log('🔄 Trying alternative PDF processing approach...')
      try {
        // Simple fallback: try to read as text (works for some PDFs)
        const text = await file.text()
        if (text && text.length > 100) {
          console.log('✅ Fallback text extraction successful')
          return text.substring(0, 1000) + '...'
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
      }
    }
    
    // Return empty string for clean failure handling
    return ''
  }
}

/**
 * Extract text from Word documents (.docx) using mammoth.js
 */
export async function extractTextFromWord(file: Blob): Promise<string> {
  try {
    console.log('📝 Starting Word document text extraction...')
    
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Extract text using mammoth
    const result = await mammoth.extractRawText({ arrayBuffer })
    
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
    // PDF files
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
    return ''
    
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