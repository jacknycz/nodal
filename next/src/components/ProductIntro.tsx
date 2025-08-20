'use client'
import React, { useEffect, useState } from 'react'
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
}

export default function ProductIntro({ open, onClose, slides }: ProductIntroProps) {
  const [index, setIndex] = useState(0)
  const total = slides?.length ?? 0

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

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute top-4 right-4">
        <IconButton aria-label="Close intro" size="md" variant="secondaryGhost" onClick={onClose}>
          ×
        </IconButton>
      </div>

      <div className="h-full min-h-screen w-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-3xl">
            {slideContent ? (
              <>{slideContent({ next, prev, close: onClose, index, total })}</>
            ) : (
              <div className="w-full text-center">
                <h2 className="text-2xl font-semibold mb-4">Slide {index + 1}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">This is a minimal product intro slide — customize content as needed.</p>
              </div>
            )}
          </div>
        </div>

        <div className="py-6 flex justify-center">
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


