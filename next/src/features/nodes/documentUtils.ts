export function extractTextFromFile(file: File): Promise<string> {
  return Promise.resolve('Document text extraction coming soon...')
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  return { valid: true }
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
    },
  }
} 