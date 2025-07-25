import { v4 as uuidv4 } from 'uuid'

// Supported file types for document upload
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'text/html': 'HTML',
  'application/xml': 'XML',
  'text/xml': 'XML'
}

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}` 
    }
  }

  // Check file type
  if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
    return { 
      valid: false, 
      error: `File type "${file.type}" is not supported. Supported types: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}` 
    }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export async function extractTextFromFile(file: File): Promise<string> {
  try {
    const fileType = file.type

    switch (fileType) {
      case 'text/plain':
      case 'text/markdown':
      case 'text/csv':
      case 'application/json':
      case 'text/html':
      case 'application/xml':
      case 'text/xml':
        return await extractTextFromTextFile(file)
      
      case 'application/pdf':
        return await extractTextFromPDF(file)
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractTextFromWord(file)
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`)
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function extractTextFromTextFile(file: File): Promise<string> {
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

async function extractTextFromPDF(file: File): Promise<string> {
  // For now, return a placeholder. In a real implementation, you'd use a PDF parsing library
  // like pdf.js or a server-side solution
  return new Promise((resolve) => {
    // Simulate PDF text extraction
    setTimeout(() => {
      resolve(`PDF Text Extraction for ${file.name}\n\nThis is a placeholder for PDF text extraction. In a production environment, you would use a PDF parsing library like pdf.js to extract the actual text content from the PDF file.\n\nFile: ${file.name}\nSize: ${formatFileSize(file.size)}\nType: PDF`)
    }, 1000)
  })
}

async function extractTextFromWord(file: File): Promise<string> {
  // For now, return a placeholder. In a real implementation, you'd use a Word parsing library
  return new Promise((resolve) => {
    // Simulate Word document text extraction
    setTimeout(() => {
      resolve(`Word Document Text Extraction for ${file.name}\n\nThis is a placeholder for Word document text extraction. In a production environment, you would use a library like mammoth.js or a server-side solution to extract the actual text content from the Word document.\n\nFile: ${file.name}\nSize: ${formatFileSize(file.size)}\nType: Word Document`)
    }, 1000)
  })
}

export async function createDocumentNode(
  file: File,
  documentId: string,
  position: { x: number; y: number },
  extractedText: string
) {
  return {
    id: documentId,
    type: 'document',
    position,
    data: {
      title: file.name,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      documentId,
      extractedText,
      type: 'document',
      uploadedAt: Date.now(),
      status: 'ready' as 'processing' | 'ready' | 'error'
    },
  }
}

export function getFileIcon(fileType: string): string {
  const icons: Record<string, string> = {
    'application/pdf': '📄',
    'text/plain': '📝',
    'text/markdown': '📝',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📄',
    'application/msword': '📄',
    'text/csv': '📊',
    'application/json': '📋',
    'text/html': '🌐',
    'application/xml': '📋',
    'text/xml': '📋'
  }
  return icons[fileType] || '📄'
}

export function getFileTypeDisplayName(fileType: string): string {
  return SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES] || 'Unknown'
} 