import { useCallback } from 'react'
import { getOpenAIService } from '../ai/aiService'
import { useBoardStore } from './boardSlice'

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
      console.log('[Upload] start', { name: file.name, type: file.type, size: file.size, position })
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
      // Optimistically add node immediately so user sees progress
      const optimisticNode: any = {
        id: nodeId,
        type: isImage ? 'image' : 'document',
        position,
        data: {
          title: file.name,
          type: isImage ? 'image' : 'document',
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          status: 'uploading' as const,
          extractedText: '',
          documentId: undefined,
          previewUrl: undefined,
        },
      }
      addNodeToStore(optimisticNode)
      console.log('[Upload] node added to store (optimistic)', { nodeId, type: optimisticNode.type })

      // Persist file
      const documentId = await boardStorage.saveDocument(file.name, file, '', localBoardIdRef.current || 'temp', nodeId)
      console.log('[Upload] saved to storage', { documentId })
      const signedUrl = await supabaseStorage.getSignedUrl(documentId)
      // Update node with documentId and preview after upload
      setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, documentId, previewUrl: signedUrl, status: 'processing' } } : n))

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
            setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, extractedText, content: extractedText, status: 'ready' } } : n))
            console.log('[Upload] extraction complete', { nodeId, length: extractedText.length })
          } else {
            setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
            console.log('[Upload] no extractable text, marked ready', { nodeId })
          }
        } catch (error: any) {
          setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, extractedText: `Text extraction failed: ${error?.message || 'Unknown error'}`, status: 'error' } } : n))
          console.warn('[Upload] extraction failed', error)
        }
      } else {
        // Non-text (likely image): attempt AI captioning using vision if available
        try {
          const ai = getOpenAIService()
          const topic = (useBoardStore.getState().topic || '').trim()
          if (ai && signedUrl) {
            const prompt = topic
              ? `Provide a concise, helpful 1-2 sentence description of this image in the context of the board topic "${topic}". Avoid guessing the person's identity.`
              : `Provide a concise, helpful 1-2 sentence description of this image. Avoid guessing the person's identity.`
            const res = await ai.generate({ prompt, maxTokens: 120, model: 'gpt-4o-mini', imageUrl: signedUrl })
            const caption = (res.content || '').trim()
            if (caption) {
              setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, content: caption, status: 'ready' } } : n))
              console.log('[Upload] vision caption ready', { nodeId })
            } else {
              setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
            }
          } else {
            setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
          }
        } catch (err) {
          console.warn('[Upload] AI caption failed; marking ready', err)
          setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'ready' } } : n))
        }
      }
    } catch (error) {
      // Update optimistic node to error state
      setNodes((current: any[]) => current.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', extractedText: 'File upload failed' } } : n))
      console.error('[Upload] failed; error node added', error)
    }
  }, [boardStorage, supabaseStorage, isTextExtractable, localBoardIdRef, addNodeToStore, setNodes])

  return { handleDocumentUpload }
}

export default useDocumentUpload


