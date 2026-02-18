'use client'

import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useBoardStore } from '../features/board/boardSlice'
import { getBoardTheme } from '../themes/board'

export default function BokehBackground() {
  const { isDark } = useTheme()
  const boardThemeKey = useBoardStore((s: any) => String((s as any)?.boardTheme || 'default'))
  const boardThemeOverrides = useBoardStore((s: any) => (s as any)?.boardThemeOverrides || null)
  const theme = getBoardTheme(boardThemeKey)

  // If the theme respects dark mode, pick the variant; otherwise stick to the single background.
  const baseBackground = theme.respectDarkMode
    ? (isDark ? (theme.backgroundDark || theme.background) : theme.background)
    : theme.background
  const background = (boardThemeKey !== 'default' && (boardThemeOverrides as any)?.background)
    ? String((boardThemeOverrides as any).background)
    : baseBackground

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background }}
    />
  )
}