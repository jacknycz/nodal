'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import bgLearn from '../assets/bg-learn.png'
import Tabs, { Tab } from './ui/Tabs'
import TextInput from './ui/TextInput'
import Button from './ui/Button'
import {
  TIPS_AND_TRICKS_VIDEOS,
  QUICK_TIPS,
  FullscreenVideoModal,
  youtubeEmbedSrc,
  youtubeThumbSrc,
  type TipsVideoItem,
} from './TipsAndTricksContent'
import { Play, Sparkle } from '@phosphor-icons/react'

export default function LearnTab() {
  const videos = useMemo(() => TIPS_AND_TRICKS_VIDEOS, [])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TipsVideoItem>(videos[0])
  const [fullscreen, setFullscreen] = useState<TipsVideoItem | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((v) => (`${v.title}\n${v.description || ''}`).toLowerCase().includes(q))
  }, [query, videos])

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-12">
      <div className="relative w-full rounded-3xl overflow-hidden">
        {/* Background image */}
        <div className="relative w-full flex justify-end">
          {/* <Image
            src={bgLearn}
            alt=""
            className="w-3xl h-auto object-contain"
            priority
            sizes="70vw"
          /> */}
        </div>
        
        {/* Content overlay */}
        <div className="absolute top-16 inset-0 z-10 flex items-start">
          <div className="flex items-top gap-3 max-w-2xl">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-primary-600 dark:text-primary-300 shrink-0">
              <Sparkle className="w-5 h-5" weight="duotone" />
            </div>
            <div className="min-w-0 flex flex-col gap-2">
              <div className="font-fredoka text-4xl text-gray-900 dark:text-white truncate drop-shadow-sm">Learn</div>
              <div className="text-gray-700 dark:text-gray-200 drop-shadow-sm">
                Tutorials, shortcuts and expert tips. This area will grow over time.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl mt-10 border border-gray-200/60 dark:border-primary-700/20 bg-white/80 dark:bg-slate-950/40 shadow-xl overflow-hidden">
        <Tabs disableRouting>
          <Tab label="overview" headerLabel="Overview">
            <div className="p-6 flex">
              <div className="relative overflow-hidden">
                {/* Background image */}
                <div className="flex justify-end pt-32">
                  <Image
                    src={bgLearn}
                    alt=""
                    className="w-full max-w-[70%] h-auto object-contain"
                    priority
                    sizes="(max-width: 1024px) 100vw, 66vw"
                  />
                </div>
                
                {/* Content overlay */}
                <div className="absolute inset-0 z-10 p-5 max-w-[600px]">
                  <div className="font-fredoka text-xl text-gray-900 dark:text-white">Start here</div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Watch a quick intro, then use Quick Tips as your "keyboard cheat-sheet".
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => setFullscreen(videos[0])}>
                      <Play className="w-4 h-4 mr-2" /> Play first video
                    </Button>
                    <Button variant="secondary" onClick={() => setSelected(videos[0])}>
                      Set as current lesson
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Tab>

          <Tab label="videos" headerLabel="Videos">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
                <TextInput
                  label=""
                  placeholder="Search videos…"
                  value={query}
                  onChange={(e) => setQuery(String((e.target as HTMLInputElement).value || ''))}
                  fullWidth
                />
                <Button variant="secondary" onClick={() => setFullscreen(selected)}>
                  Fullscreen
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
                <div className="overflow-hidden">
                  <div className="max-h-[60vh] overflow-y-auto scrollbar-themed pr-3 space-y-2">
                    {filtered.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelected(v)}
                        className={`w-full text-left rounded-2xl overflow-hidden border transition-colors ${
                          selected.id === v.id
                            ? 'border-primary-400 bg-primary-500/5'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-900/60'
                        }`}
                        title={v.title}
                      >
                        <div className="flex gap-3 p-3">
                          <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={youtubeThumbSrc(v.youtubeId)}
                              alt={v.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                              {v.title}
                            </div>
                            {v.description && (
                              <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                                {v.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 p-3">No videos found.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 overflow-hidden">
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-fredoka text-xl text-gray-900 dark:text-white truncate">
                        {selected.title}
                      </div>
                      {selected.description && (
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {selected.description}
                        </div>
                      )}
                    </div>
                    <Button onClick={() => setFullscreen(selected)} className="shrink-0">
                      <Play className="w-4 h-4 mr-2" /> Play
                    </Button>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black">
                      <iframe
                        key={selected.youtubeId}
                        className="w-full h-full"
                        src={youtubeEmbedSrc(selected.youtubeId, { autoplay: false })}
                        title={selected.title}
                        allow="encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tab>

          <Tab label="quicktips" headerLabel="Quick Tips">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {QUICK_TIPS.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/30 p-5"
                >
                  <div className="font-fredoka text-xl text-gray-900 dark:text-white">{group.title}</div>
                  <ul className="mt-3 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-2">
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

          {/* Guides tab - hidden until ready */}
          {/* <Tab label="guides" headerLabel="Guides">
            <div className="p-10 text-center">
              <div className="font-fredoka text-2xl text-gray-900 dark:text-white">Guides are coming next</div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                This tab is designed for future step-by-step lessons with images, text, and checklists.
              </div>
            </div>
          </Tab> */}
        </Tabs>
      </div>

      <FullscreenVideoModal
        open={!!fullscreen}
        onClose={() => setFullscreen(null)}
        youtubeId={fullscreen?.youtubeId || videos[0].youtubeId}
        title={fullscreen?.title || 'Video'}
      />
    </div>
  )
}

