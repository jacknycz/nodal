import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

export function useViewportCenter() {
  const { getViewport } = useReactFlow()

  const getViewportCenter = useCallback(() => {
    const viewport = getViewport()
    const centerX = -viewport.x / viewport.zoom + window.innerWidth / (2 * viewport.zoom)
    const centerY = -viewport.y / viewport.zoom + window.innerHeight / (2 * viewport.zoom)
    
    return { x: centerX, y: centerY }
  }, [getViewport])

  return { getViewportCenter }
} 