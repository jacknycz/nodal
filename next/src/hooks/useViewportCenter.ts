'use client'

import { useCallback } from 'react'

export function useViewportCenter() {
  const getViewportCenter = useCallback(() => {
    return { x: 400, y: 300 }
  }, [])

  return { getViewportCenter }
} 