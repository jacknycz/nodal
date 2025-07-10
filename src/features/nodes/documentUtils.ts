// Document processing utilities
import { v4 as uuidv4 } from 'uuid'
import type { BoardNode } from '../board/boardTypes'
import { extractTextFromFile as extractTextFromBlob, isTextExtractable } from '../storage/textExtractor'

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

// Extract text from different file types using our new extraction utilities
export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🚀 Starting text extraction for: ${file.name}`)
  
  try {
    // Use our new text extraction utilities
    const extractedText = await extractTextFromBlob(file, file.type, file.name)
    
    if (extractedText) {
      console.log(`✅ Text extraction successful: ${extractedText.length} characters`)
      return extractedText
    } else {
      console.log(`⚠️ No text extracted from: ${file.name}`)
      return `[${file.name}]\n\nNo extractable text content available.\n\nFile type: ${file.type}\nFile size: ${formatFileSize(file.size)}\nUploaded: ${new Date().toLocaleDateString()}`
    }
    
  } catch (error) {
    console.error('❌ Text extraction failed:', error)
    return `[Error extracting text from ${file.name}]\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nFile type: ${file.type}\nFile size: ${formatFileSize(file.size)}`
  }
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
  
  // Check if text extraction was successful
  const hasExtractedText = isTextExtractable(file.type, file.name) && 
                          extractedText && 
                          extractedText.length > 0 &&
                          !extractedText.startsWith('[Error') &&
                          !extractedText.includes('No extractable text content available') &&
                          !extractedText.includes('[' + file.name + ']')
  
  return {
    type: 'document',
    position,
    dragHandle: '.nodal-drag-handle',
    data: {
      label: baseName,
      content: hasExtractedText ? extractedText.slice(0, 500) : `Document: ${fileName}`, // Store first 500 chars in content
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