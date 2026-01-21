'use client'

import React, { useMemo, useState } from 'react'
import { X } from '@phosphor-icons/react'
import Tabs, { Tab } from './ui/Tabs'
import TextInput from './ui/TextInput'
import {
  TIPS_AND_TRICKS_VIDEOS,
  QUICK_TIPS,
  FullscreenVideoModal,
  youtubeThumbSrc,
  type TipsVideoItem,
} from './TipsAndTricksContent'

export default function TipsAndInfoPanel({ onClose }: { onClose: () => void }) {
  const videos: TipsVideoItem[] = useMemo(() => TIPS_AND_TRICKS_VIDEOS, [])

  const [query, setQuery] = useState('')
  const [activeVideo, setActiveVideo] = useState<TipsVideoItem | null>(null)

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
              <div className="p-4 text-sm text-gray-700 dark:text-gray-300 space-y-4">
                {QUICK_TIPS.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40 p-4"
                  >
                    <div className="font-fredoka text-base text-gray-900 dark:text-white">
                      {group.title}
                    </div>
                    <ul className="list-disc pl-5 space-y-2 mt-2">
                      {group.items.map((it, idx) => (
                        <li key={`${group.id}-${idx}`}>
                          {it.kind === 'strong' ? (
                            <>
                              <strong>{it.strong}</strong> {it.text}
                            </>
                          ) : (
                            it.text
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>

      <FullscreenVideoModal
        open={!!activeVideo}
        onClose={() => setActiveVideo(null)}
        youtubeId={activeVideo?.youtubeId || TIPS_AND_TRICKS_VIDEOS[0].youtubeId}
        title={activeVideo?.title || 'Video'}
      />
    </>
  )
}

