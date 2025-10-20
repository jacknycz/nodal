import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from './boardSlice'
import type { Node, Edge } from '@xyflow/react'

interface BoardStorageLike {
  updateBoard: (id: string, data: any) => Promise<void>
  saveBoard: (name: string, data: any) => Promise<string>
  saveBoardWithId?: (id: string, name: string, data: any) => Promise<void>
}

interface TemplateStorageLike {
  updateTemplate: (id: string, data: any) => Promise<any>
}

interface UseBoardAutosaveParams {
  boardStorage: BoardStorageLike
  templateStorage?: TemplateStorageLike
  getViewport: () => any
  getColorgories: () => any
  localBoardIdRef: React.MutableRefObject<string | null>
  onBoardStateChange?: (name: string, status: 'saved' | 'saving' | 'error', hasChanges: boolean) => void
  currentBoardName: string
  disabled?: boolean
}

export function useBoardAutosave({ boardStorage, templateStorage, getViewport, getColorgories, localBoardIdRef, onBoardStateChange, currentBoardName, disabled = false }: UseBoardAutosaveParams) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerAutosave = useCallback((nodes: Node[], edges: Edge[]) => {
    if (disabled) return
    // Safety: never autosave empty arrays (prevents accidental wipes)
    if ((!nodes || nodes.length === 0) && (!edges || edges.length === 0)) return
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (!localBoardIdRef.current) return
      try {
        setSaveStatus('saving')
        const boardData = { nodes, edges, viewport: getViewport() }
        const edgeType = useBoardStore.getState().edgeType
        await boardStorage.updateBoard(localBoardIdRef.current, { ...boardData, colorgories: getColorgories(), meta: { ...(boardData as any).meta, edgeType } })
        try {
          if (typeof window !== 'undefined') {
            const tplId = localStorage.getItem(`templateMapping:${localBoardIdRef.current}`)
            if (tplId && templateStorage) {
              await templateStorage.updateTemplate(tplId, { data: boardData })
            }
          }
        } catch {}
        setSaveStatus('saved')
        setHasUnsavedChanges(false)
        onBoardStateChange?.(currentBoardName, 'saved', false)
      } catch {
        setSaveStatus('error')
        setHasUnsavedChanges(true)
        onBoardStateChange?.(currentBoardName, 'error', true)
      }
    }, 2000)
  }, [boardStorage, templateStorage, getViewport, getColorgories, localBoardIdRef, onBoardStateChange, currentBoardName, disabled])

  useEffect(() => () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current) }, [])

  const manualSave = useCallback(async (nodes: Node[], edges: Edge[], name?: string) => {
    if (disabled) return
    try {
      // Safety: never overwrite an existing board with an empty state
      if (!name && localBoardIdRef.current && (!nodes || nodes.length === 0) && (!edges || edges.length === 0)) {
        return
      }
      setSaveStatus('saving')
      setHasUnsavedChanges(false)
      const edgeType = useBoardStore.getState().edgeType
      const boardData = { nodes, edges, viewport: getViewport(), colorgories: getColorgories(), meta: { edgeType } }
      if (localBoardIdRef.current && !name) {
        await boardStorage.updateBoard(localBoardIdRef.current, boardData)
      } else {
        const boardName = name || `Board ${new Date().toLocaleDateString()}`
        const newId = await boardStorage.saveBoard(boardName, boardData)
        localBoardIdRef.current = newId
      }
      setSaveStatus('saved')
      onBoardStateChange?.(currentBoardName, 'saved', false)
    } catch {
      setSaveStatus('error')
      setHasUnsavedChanges(true)
      onBoardStateChange?.(currentBoardName, 'error', true)
    }
  }, [boardStorage, getViewport, getColorgories, localBoardIdRef, onBoardStateChange, currentBoardName, disabled])

  return { saveStatus, hasUnsavedChanges, setHasUnsavedChanges, triggerAutosave, manualSave }
}

export default useBoardAutosave


