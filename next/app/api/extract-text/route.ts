import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API: Starting text extraction request')
    
    const body = await request.json()
    const { file, fileName, fileType } = body

    console.log(`📄 API: Processing ${fileName} (${fileType})`)

    // Convert base64 to buffer
    const buffer = Buffer.from(file, 'base64')

    let extractedText = ''

    // PDF files
    if (fileType.includes('pdf')) {
      try {
        console.log('📄 Starting PDF text extraction...')
        
        // TODO: Implement Google Cloud Vision API for PDF text extraction
        // For now, return a placeholder with instructions
        extractedText = `PDF: "${fileName}" (${buffer.length} bytes)
        
This PDF will be processed for text extraction using Google Cloud Vision API.
The extracted text will be available for AI analysis and chat context.

For visual preview, the PDF will be rendered client-side using PDF.js.

To implement Google Cloud Vision API:
1. Set up Google Cloud project
2. Enable Vision API
3. Add GOOGLE_CLOUD_CREDENTIALS environment variable
4. Use @google-cloud/vision library for PDF processing`
        
        console.log(`🎉 PDF extraction placeholder created`)
        
      } catch (error) {
        console.error('❌ PDF text extraction failed:', error)
        extractedText = 'PDF text extraction failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
    
    // Word documents
    else if (fileType.includes('word') || 
             fileType.includes('document') || 
             fileName.toLowerCase().endsWith('.docx') || 
             fileName.toLowerCase().endsWith('.doc')) {
      try {
        console.log('📝 Starting Word document text extraction...')
        
        const mammoth = await import('mammoth')
        const result = await mammoth.default.extractRawText({ buffer })
        
        if (result.messages.length > 0) {
          console.log('⚠️ Mammoth warnings:', result.messages)
        }
        
        extractedText = result.value.trim()
        console.log(`🎉 Word extraction complete! Total: ${extractedText.length} characters`)
        
      } catch (error) {
        console.error('❌ Word document text extraction failed:', error)
        extractedText = 'Word document text extraction failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
    
    // Text files
    else if (fileType.includes('text/') || 
             fileType.includes('json') || 
             fileType.includes('markdown') ||
             fileName.toLowerCase().endsWith('.txt') ||
             fileName.toLowerCase().endsWith('.md') ||
             fileName.toLowerCase().endsWith('.json')) {
      try {
        console.log('📝 Reading text file...')
        extractedText = buffer.toString('utf-8')
        console.log(`📝 Text file read: ${extractedText.length} characters`)
      } catch (error) {
        console.error('❌ Text file reading failed:', error)
        extractedText = 'Text file reading failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
    
    // Unsupported file type
    else {
      console.log(`⚠️ No text extraction available for: ${fileType}`)
      extractedText = `No text extraction available for file type: ${fileType}`
    }

    console.log('✅ API: Text extraction completed successfully')
    return NextResponse.json({ 
      success: true, 
      extractedText,
      characterCount: extractedText.length
    })

  } catch (error) {
    console.error('❌ Text extraction API error:', error)
    return NextResponse.json({ 
      error: 'Text extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 