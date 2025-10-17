"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, PlusCircle, TreeView } from '@phosphor-icons/react/ssr'
import { ArrowsOut, ArrowsIn, Pencil, PlayCircle, Spinner, CheckCircle, Warning } from '@phosphor-icons/react'
import Modal from '../../components/ui/Modal'
import TextInput from '../../components/ui/TextInput'
import TextArea from '../../components/ui/TextArea'
import Button from '../../components/ui/Button'
import IconButton from '../../components/ui/IconButton'
import { useBoardStore } from '../board/boardSlice'
import { getColorgoryHex } from '../board/colorgoryColors'
import { supabaseStorage } from '../storage/supabaseStorage'
import { getNodeContainerClasses, NODE_HANDLE_CLASS } from './nodeStyles'
import { useTheme } from '../../contexts/ThemeContext'
 
import Tooltip from '../../components/ui/Tooltip'

interface VideoNodeData {
  title?: string
  videoUrl?: string
  thumbnailUrl?: string
  status?: 'idle' | 'uploading' | 'processing' | 'loading' | 'ready' | 'error'
  colorgoryIds?: string[]
  content?: string
}

interface VideoNodeProps {
  data: VideoNodeData
  id: string
  selected?: boolean
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Partial<VideoNodeData>) => void
  onQuickAddNodes?: (nodeId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
}

export default function VideoNode({ data, id, selected, onNodeDelete, onNodeUpdate, onQuickAddNodes, onOrganizeSubtree }: VideoNodeProps) {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [inView, setInView] = useState(false)
  const viewRef = useRef<HTMLDivElement | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null)
  const [signedThumbUrl, setSignedThumbUrl] = useState<string | null>(null)
  const [showMobilePlayer, setShowMobilePlayer] = useState(false)
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null)
  const [embedHtml, setEmbedHtml] = useState<string | null>(null)
  const expandedVideoRef = useRef<HTMLVideoElement | null>(null)
  const [showStatus, setShowStatus] = useState<boolean>(!!data.status)

  const isLocked = false
  const isLockedByMe = false

  // Build colorgory ring colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => getColorgoryHex(c.id))
    : []
  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : (() => {
        const n = swatchColors.length
        const segment = 100 / n
        const blendWidth = segment * 0.3
        const half = blendWidth / 2
        const stops: string[] = []
        stops.push(`${swatchColors[0]} 0%`)
        for (let i = 0; i < n - 1; i++) {
          const boundary = segment * (i + 1)
          const p0 = Math.max(0, boundary - half)
          const p1 = Math.min(100, boundary + half)
          stops.push(`${swatchColors[i]} ${p0}%`, `${swatchColors[i + 1]} ${p1}%`)
        }
        stops.push(`${swatchColors[n - 1]} 100%`)
        return stops.join(', ')
      })()

  useEffect(() => {
    const resolveOEmbedEndpoint = (url: string): string | null => {
      try {
        const u = new URL(url)
        const host = u.hostname.toLowerCase()
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
          return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        }
        if (host.includes('vimeo.com')) {
          return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        }
        if (host.includes('dailymotion.com') || host.includes('dai.ly')) {
          return `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(url)}`
        }
        if (host.includes('loom.com')) {
          return `https://www.loom.com/oembed?url=${encodeURIComponent(url)}`
        }
        return null
      } catch { return null }
    }

    const fetchOEmbed = async (url: string) => {
      try {
        setLoading(true)
        onNodeUpdate?.(id, { status: 'loading' })
        const endpoint = resolveOEmbedEndpoint(url)
        const res = endpoint ? await fetch(endpoint) : null
        let json: any = null
        if (res && res.ok) {
          json = await res.json()
        }
        const title = (json?.title as string) || data.title || 'Video'
        const thumb = (json?.thumbnail_url as string) || ''
        if (typeof json?.html === 'string') {
          let html = json.html as string
          try {
            const m = html.match(/src="([^"]+)"/i)
            if (m && m[1]) {
              const u = new URL(m[1])
              // Add autoplay params; let sound play since user initiated expand
              u.searchParams.set('autoplay', '1')
              u.searchParams.set('playsinline', '1')
              html = html.replace(m[1], u.toString())
            }
          } catch {}
          setEmbedHtml(html)
        } else {
          setEmbedHtml(null)
        }
        // Try to fetch favicon for the video page (host domain)
        let faviconUrl: string | undefined
        try {
          const fav = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`
          faviconUrl = fav
        } catch {}
        onNodeUpdate?.(id, { title, thumbnailUrl: thumb, status: 'ready', ...(faviconUrl ? { faviconUrl } : {}) } as any)
      } catch (e) {
        onNodeUpdate?.(id, { status: 'error' })
      } finally {
        setLoading(false)
      }
    }
    if (data.videoUrl && (!data.thumbnailUrl || !data.title || data.status !== 'ready')) {
      fetchOEmbed(data.videoUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.videoUrl])

  // Lazy mount video/iframe when in viewport
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setInView(true) })
    }, { root: null, rootMargin: '200px', threshold: 0 })
    obs.observe(el)
    return () => { try { obs.disconnect() } catch {} }
  }, [])

  // Resolve signed URL for uploaded videos (document-backed)
  useEffect(() => {
    const refresh = async () => {
      const docId = (data as any)?.documentId
      if (!docId) return
      try {
        const url = await supabaseStorage.getSignedUrl(docId)
        setSignedVideoUrl(url)
      } catch {}
    }
    refresh()
    const t = setInterval(refresh, 45 * 60 * 1000)
    return () => clearInterval(t)
  }, [(data as any)?.documentId])

  // Resolve thumbnail variant URL dynamically
  useEffect(() => {
    const refreshThumb = async () => {
      const docId = (data as any)?.documentId
      if (!docId) return
      try {
        const url = await supabaseStorage.getSignedUrlForVariant(docId, '800')
        setSignedThumbUrl(url)
      } catch {}
    }
    const t0 = setTimeout(() => { refreshThumb() }, 800)
    const t = setInterval(refreshThumb, 45 * 60 * 1000)
    return () => { clearInterval(t); clearTimeout(t0) }
  }, [(data as any)?.documentId])

  // Attempt to enter fullscreen and play when mobile overlay appears
  useEffect(() => {
    if (!showMobilePlayer || !mobileVideoRef.current) return
    const v = mobileVideoRef.current
    const tryFullscreen = async () => {
      try {
        // iOS/Safari specific
        const anyV: any = v
        if (anyV?.webkitEnterFullscreen) {
          try { anyV.webkitEnterFullscreen() } catch {}
        } else if (v.requestFullscreen) {
          try { await v.requestFullscreen() } catch {}
        }
      } catch {}
    }
    try { v.play().catch(() => {}) } catch {}
    tryFullscreen()
    const onEnded = () => setShowMobilePlayer(false)
    v.addEventListener('ended', onEnded)
    return () => { v.removeEventListener('ended', onEnded); try { v.pause() } catch {} }
  }, [showMobilePlayer])

  const extractYouTubeId = (url?: string): string | null => {
    if (!url) return null
    try {
      const u = new URL(url)
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '') || null
      }
      if (u.searchParams.has('v')) {
        return u.searchParams.get('v')
      }
      const parts = u.pathname.split('/')
      const idx = parts.findIndex(p => p === 'embed')
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]
    } catch {}
    return null
  }

  const effectiveVideoUrl = (signedVideoUrl || data.videoUrl || '') as string
  const videoId = extractYouTubeId(effectiveVideoUrl)
  const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1&playsinline=1` : ''
  const isMp4 = !videoId && typeof effectiveVideoUrl === 'string' && /\.mp4($|\?)/i.test(effectiveVideoUrl)

  const containerWidthClass = expanded ? 'w-[820px]' : 'w-[260px]'
  const isBusy = (data.status === 'uploading' || data.status === 'processing')

  // Status visibility auto-hide (mirror ImageNode)
  useEffect(() => {
    setShowStatus(true)
    let timer: ReturnType<typeof setTimeout> | null = null
    if (data.status === 'ready') {
      timer = setTimeout(() => setShowStatus(false), 5000)
    }
    return () => { if (timer) clearTimeout(timer) }
  }, [data.status])

  const getStatusIcon = () => {
    switch (data.status) {
      case 'uploading':
      case 'processing':
        return <Spinner className="w-4 h-4 animate-spin text-blue-500" />
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <Warning className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  // Ensure expanded video sits above other nodes
  useEffect(() => {
    try {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null
      if (!el) return
      if (expanded) {
        el.style.zIndex = '800'
      } else {
        el.style.zIndex = ''
      }
      return () => { if (el) el.style.zIndex = '' }
    } catch {}
  }, [expanded, id])

  return (
    <div className={getNodeContainerClasses({ selected, receiveMode: false, extra: containerWidthClass })} ref={viewRef} style={!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : undefined}>
      {/* Colorgory ring overlay (hidden when expanded) */}
      {!expanded && isDark && swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            padding: 4,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}

      <Handle type="target" position={Position.Top} className={NODE_HANDLE_CLASS} />

      <div className="cursor-default">
        {!expanded ? (
          <div className="relative w-full" onClick={(e) => {
            e.stopPropagation()
            const isMobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)
            if (isMobile) {
              const href = effectiveVideoUrl || data.videoUrl
              if (href) { setShowMobilePlayer(true); return }
            }
            setExpanded(true)
          }}>
            {(signedThumbUrl || data.thumbnailUrl) ? (
              <img src={signedThumbUrl || data.thumbnailUrl!} alt={data.title || 'Video'} className="w-full h-[160px] rounded-md object-cover cursor-pointer" />
            ) : (
              <div className="w-full h-[160px] rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                {isBusy ? 'Uploading…' : (loading ? 'Loading…' : 'No thumbnail')}
              </div>
            )}
            {!isBusy && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  <IconButton variant="secondaryGhost" size="lg" aria-label="Expand video" onClick={(e) => {
                    e.stopPropagation()
                    const isMobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)
                    if (isMobile) {
                      const href = effectiveVideoUrl || data.videoUrl
                      if (href) { setShowMobilePlayer(true); return }
                    }
                    setExpanded(true)
                  }}>
                    <PlayCircle size={44} weight="duotone" />
                  </IconButton>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full">
            {embedHtml ? (
              <div className="w-[800px] h-[450px] bg-black rounded-md overflow-hidden">
                {inView && (
                  <div className="w-[800px] h-[450px]" dangerouslySetInnerHTML={{ __html: embedHtml! }} />
                )}
              </div>
            ) : embedSrc ? (
              <div className="w-[800px] h-[450px] bg-black rounded-md overflow-hidden">
                {inView && (
                <iframe
                  width="800"
                  height="450"
                  src={embedSrc}
                  title={data.title || 'YouTube video'}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />)}
              </div>
            ) : isMp4 ? (
              <div className="w-[800px] h-[450px] bg-black rounded-md overflow-hidden">
                {inView ? (
                  <video
                    ref={expandedVideoRef}
                    width={800}
                    height={450}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    poster={signedThumbUrl || data.thumbnailUrl}
                    src={effectiveVideoUrl}
                    className="w-[800px] h-[450px] object-contain bg-black"
                    onError={async () => {
                      try {
                        const docId = (data as any)?.documentId
                        if (docId) {
                          const url = await supabaseStorage.getSignedUrl(docId)
                          setSignedVideoUrl(url)
                        }
                      } catch {}
                    }}
                  />
                ) : (
                  <div className="w-[800px] h-[450px] bg-black text-gray-100 rounded-md flex items-center justify-center">Video</div>
                )}
              </div>
            ) : (
              <div className="w-[800px] h-[450px] bg-gray-900 text-gray-100 rounded-md flex items-center justify-center">No video URL</div>
            )}
            <div className="absolute top-1 left-1">
              <IconButton variant="default" size="sm" aria-label="Minimize video" onClick={(e) => { e.stopPropagation(); setExpanded(false) }}>
                <ArrowsIn size={14} />
              </IconButton>
            </div>
          </div>
        )}
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {data.title || 'Video'}
          </div>
          {data.status && (
            <div className={`mt-1 pointer-events-none flex items-center gap-1 transition-opacity duration-300 ${showStatus ? 'opacity-100' : 'opacity-0'}`}>
              {getStatusIcon()}
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {data.status === 'uploading' ? 'Uploading…' : data.status === 'processing' ? 'Processing...' : data.status === 'ready' ? 'Ready' : 'Error'}
              </span>
            </div>
          )}
          {effectiveVideoUrl && (
            <div className="mt-1 inline-flex truncate items-center gap-1 min-w-0 w-full">
              {Boolean((data as any).faviconUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(data as any).faviconUrl} alt="favicon" className="w-4 h-4 rounded-sm flex-shrink-0" />
              )}
              <a
                href={effectiveVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate w-full"
                onClick={(e) => e.stopPropagation()}
                title={effectiveVideoUrl}
              >
                {effectiveVideoUrl}
              </a>
            </div>
          )}
          {data.content && (
            <div
              className="mt-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed tiptap-content"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          )}
        </div>
      </div>

      

      {/* Mobile fullscreen overlay player */}
      {showMobilePlayer && (
        <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setShowMobilePlayer(false) }}>
          <video
            ref={mobileVideoRef}
            src={effectiveVideoUrl || data.videoUrl}
            poster={signedThumbUrl || data.thumbnailUrl}
            className="w-full h-full object-contain"
            controls
            playsInline={false as any}
            preload="auto"
          />
          <button
            className="absolute top-3 right-3 text-white bg-black/50 hover:bg-black/70 rounded px-3 py-1 text-sm"
            onClick={(e) => { e.stopPropagation(); setShowMobilePlayer(false) }}
          >
            Close
          </button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Video"
        description="Update the video title and description. To change the link, create a new node."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={() => {
              const titleInput = (document.getElementById(`video-edit-title-${id}`) as HTMLInputElement | null)
              const descInput = (document.getElementById(`video-edit-desc-${id}`) as HTMLTextAreaElement | null)
              const nextTitle = titleInput?.value?.trim() || data.title || 'Video'
              const nextContent = descInput?.value?.trim() || ''
              onNodeUpdate?.(id, { title: nextTitle, content: nextContent })
              setShowEditModal(false)
            }}>Save</Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <TextInput
            id={`video-edit-title-${id}`}
            label="Title"
            defaultValue={data.title || ''}
            fullWidth
          />
          <TextArea
            id={`video-edit-desc-${id}`}
            label="Description"
            defaultValue={data.content || ''}
            rows={3}
            fullWidth
          />
          {data.videoUrl && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Video URL: {data.videoUrl}
            </div>
          )}
        </div>
      </Modal>

      <Handle type="source" position={Position.Bottom} className={NODE_HANDLE_CLASS} />
    </div>
  )
}


