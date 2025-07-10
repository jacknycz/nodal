// Document processing utilities
import { v4 as uuidv4 } from 'uuid'
import type { BoardNode } from '../board/boardTypes'

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': { name: 'PDF', icon: '📄' },
  'text/plain': { name: 'Text', icon: '📝' },
  'text/markdown': { name: 'Markdown', icon: '📝' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { name: 'Word', icon: '📄' },
  'application/msword': { name: 'Word', icon: '📄' },
  'image/png': { name: 'PNG Image', icon: '🖼️' },
  'image/jpeg': { name: 'JPEG Image', icon: '🖼️' },
  'image/jpg': { name: 'JPG Image', icon: '🖼️' },
  'image/gif': { name: 'GIF Image', icon: '🖼️' },
  'image/webp': { name: 'WebP Image', icon: '🖼️' },
}

// File size limits (in bytes)
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Extract text from different file types
export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type.toLowerCase()
  
  try {
    if (fileType.includes('text') || fileType.includes('markdown')) {
      return await extractFromTextFile(file)
    }
    
    if (fileType.includes('pdf')) {
      return await extractFromPDF(file)
    }
    
    if (fileType.includes('word') || fileType.includes('document')) {
      return await extractFromWordDocument(file)
    }
    
    if (fileType.includes('image')) {
      return await extractFromImage(file)
    }
    
    // Fallback: try to read as text
    return await extractFromTextFile(file)
  } catch (error) {
    console.error('Failed to extract text from file:', error)
    return `[Could not extract text from ${file.name}]`
  }
}

// Extract text from plain text files
async function extractFromTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      resolve(text || '')
    }
    reader.onerror = () => reject(new Error('Failed to read text file'))
    reader.readAsText(file)
  })
}

// Extract text from PDF (placeholder - would need pdf.js or similar library)
async function extractFromPDF(file: File): Promise<string> {
  // For now, return a placeholder message
  // In a real implementation, you'd use pdf.js:
  // import * as pdfjsLib from 'pdfjs-dist'
  
  return `[PDF Document: ${file.name}]
  
This is a PDF document that has been uploaded. 
To implement full text extraction, you would integrate a library like pdf.js.

File size: ${formatFileSize(file.size)}
Upload date: ${new Date().toLocaleDateString()}`
}

// Extract text from Word documents (placeholder)
async function extractFromWordDocument(file: File): Promise<string> {
  // For now, return a placeholder message
  // In a real implementation, you'd use mammoth.js or similar library
  
  return `[Word Document: ${file.name}]
  
This is a Word document that has been uploaded.
To implement full text extraction, you would integrate a library like mammoth.js.

File size: ${formatFileSize(file.size)}
Upload date: ${new Date().toLocaleDateString()}`
}

// Extract text from images (placeholder - would need OCR)
async function extractFromImage(file: File): Promise<string> {
  // For now, return a placeholder message
  // In a real implementation, you'd use Tesseract.js or similar OCR library
  
  return `[Image: ${file.name}]
  
This is an image file that has been uploaded.
To implement text extraction, you would integrate an OCR library like Tesseract.js.

File size: ${formatFileSize(file.size)}
Upload date: ${new Date().toLocaleDateString()}`
}

// Validate file for upload
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`
    }
  }

  // Check file type
  const supportedTypes = Object.keys(SUPPORTED_FILE_TYPES)
  const isSupported = supportedTypes.some(type => 
    file.type.toLowerCase().includes(type.toLowerCase()) ||
    file.name.toLowerCase().endsWith('.txt') ||
    file.name.toLowerCase().endsWith('.md') ||
    file.name.toLowerCase().endsWith('.markdown')
  )

  if (!isSupported) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Supported types: PDF, Word, Text, Markdown, Images`
    }
  }

  return { valid: true }
}

// Create a document node from a file
export function createDocumentNode(
  file: File,
  documentId: string,
  position: { x: number; y: number },
  extractedText: string
): Omit<BoardNode, 'id'> {
  const fileName = file.name
  const baseName = fileName.split('.').slice(0, -1).join('.') || fileName
  
  return {
    type: 'document',
    position,
    dragHandle: '.nodal-drag-handle',
    data: {
      label: baseName,
      content: extractedText.slice(0, 500), // Store first 500 chars in content
      type: 'document',
      expanded: false,
      aiGenerated: false,
      documentId,
      fileName,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: Date.now(),
      extractedText,
    },
  }
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Generate a shortened label from filename
export function generateDocumentLabel(fileName: string): string {
  // Remove extension
  const baseName = fileName.split('.').slice(0, -1).join('.') || fileName
  
  // Truncate if too long
  if (baseName.length > 30) {
    return baseName.substring(0, 27) + '...'
  }
  
  return baseName
} 