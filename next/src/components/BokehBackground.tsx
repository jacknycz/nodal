'use client'

import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useBoardStore } from '../features/board/boardSlice'
import { getBoardTheme } from '../themes/board'

export default function BokehBackground() {
  const { isDark } = useTheme()
  const boardThemeKey = useBoardStore((s: any) => String((s as any)?.boardTheme || 'default'))
  const theme = getBoardTheme(boardThemeKey)

  // If the theme respects dark mode, pick the variant; otherwise stick to the single background.
  const background = theme.respectDarkMode
    ? (isDark ? (theme.backgroundDark || theme.background) : theme.background)
    : theme.background

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background }}
    />
  )
}