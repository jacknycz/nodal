'use client'

import { useEffect } from 'react'

export default function ClientViewportFix() {
  useEffect(() => {
    const onResize = () => {
      const active = document.activeElement as (HTMLElement | null)
      if (active && active.tagName === 'INPUT') {
        active.blur()
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return null
}


