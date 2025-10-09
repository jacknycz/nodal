'use client'

import React, { useEffect } from 'react'

export default function AdminDarkClient({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains('dark')
    if (!hadDark) html.classList.add('dark')
    return () => {
      if (!hadDark) html.classList.remove('dark')
    }
  }, [])

  return <>{children}</>
}


