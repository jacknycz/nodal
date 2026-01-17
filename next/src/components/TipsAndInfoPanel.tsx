'use client'

import React, { useMemo, useState } from 'react'
import { X } from '@phosphor-icons/react'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Tabs, { Tab } from './ui/Tabs'
import TextInput from './ui/TextInput'

type VideoItem = {
  id: string
  title: string
  description?: string
  youtubeId: string
}

function youtubeEmbedSrc(youtubeId: string) {
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
}

function youtubeThumbSrc(youtubeId: string) {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

function FullscreenVideoModal({
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
              src={youtubeEmbedSrc(youtubeId)}
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

export default function TipsAndInfoPanel({ onClose }: { onClose: () => void }) {
  const videos: VideoItem[] = useMemo(() => {
    return [
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
  }, [])

  const [query, setQuery] = useState('')
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((v) => {
      const hay = `${v.title}\n${v.description || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, videos])

  return (
    <>
      <div className="relative rounded-3xl z-60 w-[min(92vw,980px)] max-w-[calc(100vw-80px)] max-h-[calc(100dvh-80px)] bg-white dark:bg-gray-900 shadow-xl flex flex-col overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close Tips & Info"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 min-h-0">
          <Tabs disableRouting>
            <Tab label="videos" headerLabel="Videos">
              <div className="p-4 flex flex-col gap-3">
                <TextInput
                  label=""
                  placeholder="Search videos…"
                  value={query}
                  onChange={(e) => setQuery(String((e.target as HTMLInputElement).value || ''))}
                  fullWidth
                />

                <div className="overflow-y-auto scrollbar-themed max-h-[calc(100dvh-260px)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filtered.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setActiveVideo(v)}
                        className="text-left rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                        title={v.title}
                      >
                        <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={youtubeThumbSrc(v.youtubeId)}
                            alt={v.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/10" />
                        </div>
                        <div className="p-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                            {v.title}
                          </div>
                          {v.description && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              {v.description}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {filtered.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">No videos found.</div>
                  )}
                </div>
              </div>
            </Tab>

            <Tab label="quicktips" headerLabel="Quick Tips">
              <div className="p-4 text-sm text-gray-700 dark:text-gray-300">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Mouse wheel</strong> zooms the board in and out.</li>
                  <li><strong>Click & drag</strong> on empty space to pan the board.</li>
                  <li><strong>Cmd/Ctrl + click</strong> nodes to multi-select.</li>
                  <li><strong>Shift + click</strong> a second node (with one selected) to connect them.</li>
                  <li><strong>Shift + drag</strong> to marquee-select multiple nodes.</li>
                  <li><strong>Undo</strong>: Cmd + Z (Mac) / Ctrl + Z (Windows).</li>
                  <li><strong>Redo</strong>: Cmd + Shift + Z (Mac) / Ctrl + Shift + Z (Windows).</li>
                  <li><strong>Drag & drop</strong> files onto the board to create nodes.</li>
                  <li><strong>Double‑click</strong> a node to open editing.</li>
                  <li>Use the bottom FAB to add nodes, upload, or generate with AI.</li>
                </ul>
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>

      <FullscreenVideoModal
        open={!!activeVideo}
        onClose={() => setActiveVideo(null)}
        youtubeId={activeVideo?.youtubeId || '28zfa1WEHS0'}
        title={activeVideo?.title || 'Video'}
      />
    </>
  )
}

