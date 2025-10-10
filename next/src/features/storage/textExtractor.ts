// Remove the top-level imports that cause SSR issues
// import * as pdfjsLib from 'pdfjs-dist'
// import mammoth from 'mammoth'

/**
 * Extract text from PDF files using PDF.js (dynamic import)
 * Temporarily disabled due to SSR issues
 */
export async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    console.log('📄 PDF text extraction temporarily disabled due to compatibility issues')
    
    // For now, return a simple message indicating PDF processing is disabled
    return `PDF file "${file.type}" uploaded successfully. 
    
Text extraction from PDFs is temporarily disabled due to technical issues.
The file has been uploaded and can be previewed using the preview button.

File size: ${(file.size / 1024).toFixed(1)} KB`
    
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