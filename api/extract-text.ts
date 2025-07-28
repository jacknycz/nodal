import { VercelRequest, VercelResponse } from '@vercel/node'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Set up PDF.js worker for server-side
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.min.js')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { file, fileName, fileType } = req.body

    if (!file || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing file, fileName, or fileType' })
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(file, 'base64')
    const blob = new Blob([buffer])

    console.log(`🔍 Server-side text extraction for: ${fileName} (${fileType})`)

    let extractedText = ''

    // PDF files
    if (fileType.includes('pdf')) {
      try {
        console.log('📄 Starting PDF text extraction...')
        
        const arrayBuffer = await blob.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          disableAutoFetch: true,
          disableStream: true,
        })
        
        const pdf = await loadingTask.promise
        console.log(`📊 PDF loaded successfully with ${pdf.numPages} pages`)
        
        const textParts: string[] = []
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          console.log(`🔄 Processing page ${pageNum}/${pdf.numPages}...`)
          
          try {
            const page = await pdf.getPage(pageNum)
            const textContent = await page.getTextContent()
            
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
        
        extractedText = textParts.join('\n\n')
        console.log(`🎉 PDF extraction complete! Total: ${extractedText.length} characters`)
        
      } catch (error) {
        console.error('❌ PDF text extraction failed:', error)
        extractedText = 'PDF text extraction failed'
      }
    }
    
    // Word documents
    else if (fileType.includes('word') || 
             fileType.includes('document') || 
             fileName.toLowerCase().endsWith('.docx') || 
             fileName.toLowerCase().endsWith('.doc')) {
      try {
        console.log('📝 Starting Word document text extraction...')
        
        const arrayBuffer = await blob.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        
        if (result.messages.length > 0) {
          console.log('⚠️ Mammoth warnings:', result.messages)
        }
        
        extractedText = result.value.trim()
        console.log(`🎉 Word extraction complete! Total: ${extractedText.length} characters`)
        
      } catch (error) {
        console.error('❌ Word document text extraction failed:', error)
        extractedText = 'Word document text extraction failed'
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
        extractedText = await blob.text()
        console.log(`📝 Text file read: ${extractedText.length} characters`)
      } catch (error) {
        console.error('❌ Text file reading failed:', error)
        extractedText = 'Text file reading failed'
      }
    }
    
    // Unsupported file type
    else {
      console.log(`⚠️ No text extraction available for: ${fileType}`)
      extractedText = ''
    }

    return res.status(200).json({ 
      success: true, 
      extractedText,
      characterCount: extractedText.length
    })

  } catch (error) {
    console.error('❌ Text extraction API error:', error)
    return res.status(500).json({ 
      error: 'Text extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 