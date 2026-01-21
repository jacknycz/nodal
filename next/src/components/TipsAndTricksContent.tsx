'use client'

import React from 'react'
import { X } from '@phosphor-icons/react'
import Button from './ui/Button'
import Modal from './ui/Modal'

export type TipsVideoItem = {
  id: string
  title: string
  description?: string
  youtubeId: string
}

export const TIPS_AND_TRICKS_VIDEOS: TipsVideoItem[] = [
  {
    id: 'create-board',
    youtubeId: '28zfa1WEHS0',
    title: 'Create a New Board',
    description: 'Get started with Nodal by creating your new board.',
  },
  {
    id: 'add-nodes',
    youtubeId: 'WpCCaVsWPXI',
    title: 'How to Add Nodes',
    description: 'We go over the several different ways to add new nodes to the board.',
  },
  {
    id: 'right-click-actions',
    youtubeId: 'eTgQqKCvcSs',
    title: 'Right-click Actions',
    description: "Nodal has a really useful right-click, so here's a little bit about it.",
  },
  {
    id: 'intro-colorgories',
    youtubeId: 'wXvaUKJAqKc',
    title: 'Intro to Colorgories',
    description: 'Colorgories are visual categories inside of Nodal - learn a bit about how they can help your board.',
  },
  {
    id: 'generate-ai-nodes',
    youtubeId: '40N_aHbWJ3I',
    title: 'Generate AI Nodes',
    description: 'A quick lesson on how to use AI to add nodes to the board for you.',
  },
  {
    id: 'search-your-board',
    youtubeId: 'DWmOrBzBWPY',
    title: 'Search your board',
    description: 'Quickly going over a simple but kinda fun zooming search feature with your Nodal board.',
  },
  {
    id: 'summarize-nodes',
    youtubeId: 'xdXuOIzshZA',
    title: 'How to summarize nodes',
    description: `In this quick tutorial we'll cover how the "Summarize nodes" feature works on your Nodal board.`,
  },
]

export type QuickTipItem =
  | { kind: 'strong'; strong: string; text: string }
  | { kind: 'plain'; text: string }

export const QUICK_TIPS: Array<{ id: string; title: string; items: QuickTipItem[] }> = [
  {
    id: 'basics',
    title: 'Basics',
    items: [
      { kind: 'strong', strong: 'Mouse wheel', text: 'zooms the board in and out.' },
      { kind: 'strong', strong: 'Click & drag', text: 'on empty space to pan the board.' },
      { kind: 'strong', strong: 'Drag & drop', text: 'files onto the board to create nodes.' },
      { kind: 'strong', strong: 'Double‑click', text: 'a node to open editing.' },
      { kind: 'plain', text: 'Use the bottom FAB to add nodes, upload, or generate with AI.' },
    ],
  },
  {
    id: 'selection-connecting',
    title: 'Selection & Connecting',
    items: [
      { kind: 'strong', strong: 'Cmd/Ctrl + click', text: 'nodes to multi-select.' },
      { kind: 'strong', strong: 'Shift + click', text: 'a second node (with one selected) to connect them.' },
      { kind: 'strong', strong: 'Shift + drag', text: 'to marquee-select multiple nodes.' },
    ],
  },
  {
    id: 'undo-redo',
    title: 'Undo / Redo',
    items: [
      { kind: 'strong', strong: 'Undo', text: ': Cmd + Z (Mac) / Ctrl + Z (Windows).' },
      { kind: 'strong', strong: 'Redo', text: ': Cmd + Shift + Z (Mac) / Ctrl + Shift + Z (Windows).' },
    ],
  },
]

export function youtubeEmbedSrc(youtubeId: string, opts?: { autoplay?: boolean }) {
  const autoplay = opts?.autoplay ? 1 : 0
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay}&rel=0&modestbranding=1&playsinline=1`
}

export function youtubeThumbSrc(youtubeId: string) {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

export function FullscreenVideoModal({
  open,
  onClose,
  youtubeId,
  title,
}: {
  open: boolean
  onClose: () => void
  youtubeId: string
  title?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      scrollBody={false}
      backdropClassName="bg-black/90"
      backdropInteractive={true}
      // Our modal content is fullscreen, so there is no "outside content" backdrop area to click.
      // Instead we implement "click outside the video player closes" inside the content layer.
      closeOnBackdropClick={false}
      showCloseButton={false}
      className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !p-0 !mx-0 !rounded-none !bg-black !dark:bg-black"
    >
      <div
        className="relative w-full h-full bg-black"
        onClick={() => onClose()}
        onPointerDown={() => onClose()}
      >
        {/* Top controls (do NOT close when interacting with these) */}
        <div
          className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="text-white/90 font-fredoka text-lg truncate pr-4">
            {title || 'Video'}
          </div>
          <Button
            variant="icon"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            aria-label="Close video"
            className="bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Player area (stop propagation so clicks inside the player don't close) */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <div
            className="w-full max-w-[1400px] aspect-video rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <iframe
              key={youtubeId}
              className="w-full h-full"
              src={youtubeEmbedSrc(youtubeId, { autoplay: true })}
              title={title || 'YouTube video'}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

