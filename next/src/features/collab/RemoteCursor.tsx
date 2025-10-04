"use client"

import React, { useEffect, useRef, useState } from 'react'
import type { CursorPayload } from './types'

interface Props {
  cursor: CursorPayload
  // Convert board coords to screen coords
  toScreen: (x: number, y: number) => { x: number; y: number }
}

export default function RemoteCursor({ cursor, toScreen }: Props) {
  const [pos, setPos] = useState(() => toScreen(cursor.x, cursor.y))
  const targetRef = useRef(pos)
  const rafRef = useRef<number | null>(null)

  useEffect(() => { targetRef.current = toScreen(cursor.x, cursor.y) }, [cursor.x, cursor.y, toScreen])

  useEffect(() => {
    const step = () => {
      const cur = pos
      const tgt = targetRef.current
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t
      const next = { x: lerp(cur.x, tgt.x, 0.25), y: lerp(cur.y, tgt.y, 0.25) }
      setPos(next)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const idleMs = Math.max(0, Date.now() - (cursor.ts || 0))
  const opacity = idleMs > 5000 ? 0 : 1

  // Small hotspot adjustment so the dot sits closer to the OS cursor tip
  const HOTSPOT_X = 0
  const HOTSPOT_Y = 0

  return (
    <div className="pointer-events-none absolute" style={{ left: 0, top: 0, transform: `translate(${pos.x + HOTSPOT_X}px, ${pos.y + HOTSPOT_Y}px)`, opacity }}>
      <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cursor.user.color }} />
        <div className="mt-1 px-1.5 py-0.5 rounded text-[10px] leading-none text-white"
          style={{ backgroundColor: cursor.user.color }}>
          {cursor.user.name || 'User'}
        </div>
      </div>
    </div>
  )
}


