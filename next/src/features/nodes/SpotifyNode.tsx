"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import IconButton from '../../components/ui/IconButton'
import { ArrowsIn, ArrowsOut, PlayCircle } from '@phosphor-icons/react/ssr'
import { getMediaNodeContainerClasses, NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'
import { useBoardStore } from '../board/boardSlice'
import { getColorgoryHex } from '../board/colorgoryColors'
import { useTheme } from '../../contexts/ThemeContext'

interface SpotifyNodeData {
  title?: string
  authorName?: string
  thumbnailUrl?: string
  spotifyUrl?: string
  embedUrl?: string
  status?: 'loading' | 'ready' | 'error'
  colorgoryIds?: string[]
  content?: string
}

interface SpotifyNodeProps {
  data: SpotifyNodeData
  id: string
  selected?: boolean
  onNodeUpdate?: (nodeId: string, updates: Partial<SpotifyNodeData>) => void
  readOnly?: boolean
}

export default function SpotifyNode({ data, id, selected, onNodeUpdate, readOnly = false }: SpotifyNodeProps) {
  const { isDark } = useTheme()
  // Testing: no collapsed state, always show full player
  const viewRef = useRef<HTMLDivElement | null>(null)
  const [oembedHtml, setOembedHtml] = useState<string | null>(null)

  // Build colorgory ring colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => getColorgoryHex(c.id))
    : []
  const gradientStops = useMemo(() => {
    if (swatchColors.length <= 1) return (swatchColors[0] || '')
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
  }, [swatchColors])

  // No lazy gating during testing

  // 🔧 Utility function: safely build a Spotify embed URL
  const getSpotifyEmbedUrl = (originalUrl?: string): string => {
    if (!originalUrl) return ''
    try {
      const u = new URL(originalUrl)
      const cleanPath = u.pathname.replace(/^\/+/, '').replace(/\/$/, '')
      // Podcast episodes may use a different base
      if (cleanPath.startsWith('episode/')) {
        return `https://open.spotify.com/embed-podcast/${cleanPath}`
      }
      if (cleanPath.startsWith('embed/')) {
        return `https://open.spotify.com/${cleanPath}`
      }
      return `https://open.spotify.com/embed/${cleanPath}`
    } catch {
      return ''
    }
  }

  // Fetch oEmbed metadata on first mount if missing
  useEffect(() => {
    const run = async () => {
      const url = data.spotifyUrl
      if (!url) return
      if (data.title && data.thumbnailUrl && data.status === 'ready' && (data.embedUrl || oembedHtml)) return
      try {
        onNodeUpdate?.(id, { status: 'loading' })
        const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
        const res = await fetch(endpoint)
        let json: any = null
        if (res.ok) json = await res.json()
        const title = (json?.title as string) || data.title || 'Spotify'
        const authorName = (json?.author_name as string) || data.authorName || ''
        const thumbnailUrl = (json?.thumbnail_url as string) || data.thumbnailUrl || ''
        const embedUrl = data.embedUrl || getSpotifyEmbedUrl(url)
        if (typeof json?.html === 'string' && !embedUrl) {
          setOembedHtml(json.html as string)
        }
        onNodeUpdate?.(id, { title, authorName, thumbnailUrl, embedUrl, status: 'ready' })
      } catch {
        onNodeUpdate?.(id, { status: 'error' })
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.spotifyUrl])

  const containerWidthClass = 'w-[520px]'
  const effectiveEmbed = useMemo(() => {
    return getSpotifyEmbedUrl(data.embedUrl || data.spotifyUrl)
  }, [data.embedUrl, data.spotifyUrl])

  // Render any content as plain text to avoid interpreting pasted JSX/HTML
  const plainContent = useMemo(() => {
    const raw = data.content || ''
    try {
      return raw.replace(/<[^>]*>/g, '')
    } catch { return raw }
  }, [data.content])

  return (
    <div className={getMediaNodeContainerClasses({ selected, receiveMode: false, extra: containerWidthClass })} ref={viewRef} style={!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : undefined}>
      {isDark && swatchColors.length > 0 && (
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

      <Handle type="target" position={Position.Top} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />

      <div className="cursor-default">
        <div className="relative w-full">
          <div className="w-[500px] h-[152px] bg-black rounded-md overflow-hidden">
            {(effectiveEmbed || oembedHtml) ? (
              effectiveEmbed ? (
                <iframe
                  key={effectiveEmbed}
                  src={effectiveEmbed}
                  width="500"
                  height="152"
                  style={{ border: 0 }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  title={data.title || 'Spotify player'}
                />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: oembedHtml as string }} />
              )
            ) : (
              data.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.thumbnailUrl} alt={data.title || 'Spotify'} className="w-full h-[152px] object-cover" />
              ) : (
                <div className="w-full h-[152px] flex items-center justify-center text-gray-400 text-sm">{data.status === 'loading' ? 'Loading…' : 'Spotify'}</div>
              )
            )}
          </div>
        </div>
        <div className="mt-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={data.title || 'Spotify'}>
            {data.title || 'Spotify'}
          </div>
          {data.authorName && (
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{data.authorName}</div>
          )}
          {data.spotifyUrl && (
            <div className="mt-1 inline-flex truncate items-center gap-1 min-w-0 w-full">
              <a
                href={data.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate w-full"
                onClick={(e) => e.stopPropagation()}
                title={data.spotifyUrl}
              >
                {data.spotifyUrl}
              </a>
            </div>
          )}
          {plainContent && (
            <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{plainContent}</div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />
    </div>
  )
}


