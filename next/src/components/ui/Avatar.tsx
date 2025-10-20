'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import { useBoardStore } from '../../features/board/boardSlice'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  src?: string | null
  name?: string | null
  email?: string | null
  seed?: string | null
  size?: AvatarSize
  className?: string
  ring?: boolean
  border?: boolean
}

const sizeClasses: Record<AvatarSize, { box: string; text: string; img: number }> = {
  xs: { box: 'w-6 h-6 text-[10px]', text: 'text-[10px]', img: 24 },
  sm: { box: 'w-8 h-8 text-xs', text: 'text-xs', img: 32 },
  md: { box: 'w-10 h-10 text-sm', text: 'text-sm', img: 40 },
  lg: { box: 'w-12 h-12 text-base', text: 'text-base', img: 48 },
  xl: { box: 'w-16 h-16 text-2xl', text: 'text-2xl', img: 64 },
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').trim()
  const norm = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const int = parseInt(norm, 16)
  if (!Number.isFinite(int) || (norm.length !== 6)) return null
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function getContrastTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#ffffff'
  // Perceived luminance
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.62 ? '#111111' : '#ffffff'
}

export default function Avatar({ src, name, email, seed, size = 'md', className = '', ring = false, border = true }: AvatarProps) {
  // IMPORTANT: Don't derive a new array in the selector; it must be stable to avoid useSyncExternalStore warnings
  const colorgories = useBoardStore((s: any) => s.colorgories || []) as any[]
  const userPalette = useMemo(() => (colorgories || []).map((c: any) => c?.color).filter(Boolean) as string[], [colorgories])
  const palette = userPalette && userPalette.length > 0
    ? userPalette
    : ['#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']

  const display = useMemo(() => {
    const s = (seed || name || email || '').toString()
    const base = s || 'U'
    const initials = (() => {
      if (!name && email) return email.slice(0, 2).toUpperCase()
      const parts = (name || base).split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
      return base.slice(0, 2).toUpperCase()
    })()
    const hash = Array.from(base).reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)
    const bg = palette[Math.abs(hash) % palette.length]
    const fg = getContrastTextColor(bg)
    return { initials, bg, fg }
  }, [seed, name, email, palette])

  const sz = sizeClasses[size]
  const outerRing = ring ? 'ring-1 ring-white dark:ring-black' : ''
  const borderCls = border ? 'border-2 border-gray-200 dark:border-gray-700' : ''

  if (src) {
    return (
      <Image
        src={src}
        alt={name || email || 'avatar'}
        width={sz.img}
        height={sz.img}
        className={`${sz.box} rounded-full object-cover ${borderCls} ${outerRing} ${className}`}
        unoptimized
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold ${sz.box} ${borderCls} ${outerRing} ${className}`}
      style={{ backgroundColor: display.bg, color: display.fg }}
    >
      <span className={`${sz.text}`}>{display.initials}</span>
    </div>
  )
}


