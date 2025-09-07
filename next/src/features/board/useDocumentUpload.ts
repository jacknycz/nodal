import { useCallback } from 'react'

interface BoardStorageLike {
  saveDocument: (name: string, file: File, extracted: string, boardId: string, nodeId: string) => Promise<string>
}

interface SupabaseStorageLike {
  getSignedUrl: (documentId: string) => Promise<string>
  updateDocumentExtractedText: (documentId: string, text: string) => Promise<void>
}

interface UseDocumentUploadParams {
  boardStorage: BoardStorageLike
  supabaseStorage: SupabaseStorageLike
  isTextExtractable: (fileType: string, fileName: string) => boolean
  localBoardIdRef: React.MutableRefObject<string | null>
  addNodeToStore: (node: any) => void
  setNodes: React.Dispatch<any>
}

export function useDocumentUpload({ boardStorage, supabaseStorage, isTextExtractable, localBoardIdRef, addNodeToStore, setNodes }: UseDocumentUploadParams) {
  const handleDocumentUpload = useCallback(async (file: File, position: { x: number; y: number }) => {
    const nodeId = `document-${Date.now()}`
    try {
      const documentId = await boardStorage.saveDocument(file.name, file, '', localBoardIdRef.current || 'temp', nodeId)
      const signedUrl = await supabaseStorage.getSignedUrl(documentId)
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
      const newNode: any = {
        id: nodeId,
        type: isImage ? 'image' : 'document',
        position,
        data: { title: file.name, type: isImage ? 'image' : 'document', fileName: file.name, fileType: file.type || 'unknown', fileSize: file.size, status: 'processing' as const, extractedText: '', documentId, previewUrl: signedUrl },
      }
      addNodeToStore(newNode)

      if (isTextExtractable(file.type, file.name)) {
        try {
          let extractedText = ''
          if (file.type.includes('pdf')) {
            try {
              const resp = await fetch('/api/documents/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedUrl, fileName: file.name, fileType: file.type }) })
              if (!resp.ok) throw new Error(`Extraction request failed (${resp.status})`)
              const json = await resp.json()
              if (typeof json?.extractedText === 'string' && json.extractedText.length > 0) extractedText = json.extractedText
            } catch {}
          } else {
            const { extractTextFromFile } = await import('../storage/textExtractor')
            extractedText = await extractTextFromFile(file, file.type, file.name)
          }

          if (extractedText && extractedText.length > 0) {
            try { await supabaseStorage.updateDocumentExtractedText(documentId, extractedText) } catch {}
            setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, extractedText, status: 'ready' } } : n))
          } else {
            setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
          }
        } catch (error: any) {
          setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, extractedText: `Text extraction failed: ${error?.message || 'Unknown error'}`, status: 'error' } } : n))
        }
      } else {
        setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
      }
    } catch (error) {
      const isImage2 = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
      const newNode: any = { id: nodeId, type: isImage2 ? 'image' : 'document', position, data: { title: file.name, type: isImage2 ? 'image' : 'document', fileName: file.name, fileType: file.type || 'unknown', fileSize: file.size, status: 'error' as const, extractedText: 'File upload failed' } }
      addNodeToStore(newNode)
    }
  }, [boardStorage, supabaseStorage, isTextExtractable, localBoardIdRef, addNodeToStore, setNodes])

  return { handleDocumentUpload }
}

export default useDocumentUpload


