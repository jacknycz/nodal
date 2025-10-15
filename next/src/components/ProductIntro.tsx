'use client'
import React, { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import Button from './ui/Button'
import IconButton from './ui/IconButton'

interface SlideApi {
  next: () => void
  prev: () => void
  close: () => void
  index: number
  total: number
}

export type SlideRenderer = (api: SlideApi) => React.ReactNode

interface ProductIntroProps {
  open: boolean
  onClose: () => void
  slides?: SlideRenderer[]
  mode?: 'overlay' | 'page'
}

export default function ProductIntro({ open, onClose, slides, mode = 'overlay' }: ProductIntroProps) {
  const [index, setIndex] = useState(0)
  const total = slides?.length ?? 0
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
  }

  useEffect(() => {
    if (!open) setIndex(0)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const next = () => setIndex(i => Math.min(i + 1, Math.max(0, total - 1)))
  const prev = () => setIndex(i => Math.max(i - 1, 0))

  const slideContent = slides && slides[index]

  const isOverlay = mode === 'overlay'
  return (
    <div className={isOverlay ? "fixed h-full min-h-[100dvh] w-full flex inset-0 z-[1000]" : "relative h-full min-h-[100dvh] w-full z-0"}>
      <div className="absolute top-6 right-6 z-10">
        <IconButton aria-label="Close intro" size="md" variant="primaryOutline" onClick={onClose}>
          ×
        </IconButton>
      </div>

      <div className={isOverlay ? "h-full min-h-[100dvh] relative w-full flex flex-col bg-white dark:bg-primary-950 text-gray-900 dark:text-white" : "h-full w-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-white"}>
        <div
          className="flex h-full min-h-[100dvh] items-center justify-center"
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return
            const t = e.touches[0]
            touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current
            touchStartRef.current = null
            if (!start) return
            const t = e.changedTouches && e.changedTouches[0]
            if (!t) return
            const dx = t.clientX - start.x
            const dy = t.clientY - start.y
            const adx = Math.abs(dx)
            const ady = Math.abs(dy)
            const dt = Date.now() - start.t
            // Horizontal swipe threshold with angle guard and quick flick support
            const distanceOk = adx > 48 && adx > ady * 1.2
            const quickFlick = dt < 220 && adx > 24 && adx > ady * 1.1
            if (distanceOk || quickFlick) {
              if (dx < 0) {
                next()
              } else {
                prev()
              }
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              {slideContent ? (
                <>{slideContent({ next, prev, close: onClose, index, total })}</>
              ) : (
                <div className="w-full text-center">
                  <h2 className="text-2xl font-semibold mb-4">Slide {index + 1}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">This is a minimal product intro slide — customize content as needed.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={isOverlay ? "py-6 fixed bottom-0 inset-x-0 flex justify-center z-[1100]" : "py-6 absolute bottom-0 inset-x-0 flex justify-center"}>
          <div className="flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <IconButton
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                size="sm"
                variant={i === index ? 'primary' : 'secondaryGhost'}
                onClick={() => setIndex(i)}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
              </IconButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


