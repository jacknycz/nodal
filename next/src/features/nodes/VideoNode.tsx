"use client"

import React, { useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash } from '@phosphor-icons/react/ssr'
import { ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import IconButton from '../../components/ui/IconButton'
import { useBoardStore } from '../board/boardSlice'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
import NodeActionDrawer from './NodeActionDrawer'
import ColorgoryQuickMenu from './ColorgoryQuickMenu'

interface VideoNodeData {
  title?: string
  videoUrl?: string
  thumbnailUrl?: string
  status?: 'idle' | 'loading' | 'ready' | 'error'
  colorgoryIds?: string[]
}

interface VideoNodeProps {
  data: VideoNodeData
  id: string
  selected?: boolean
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Partial<VideoNodeData>) => void
  // Locking
  isNodeLocked?: (nodeId: string) => boolean
  isNodeLockedByMe?: (nodeId: string) => boolean
}

export default function VideoNode({ data, id, selected, onNodeDelete, onNodeUpdate, isNodeLocked, isNodeLockedByMe }: VideoNodeProps) {
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false

  // Build colorgory ring colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []
  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : swatchColors.map((color, index) => {
        const percentage = (index / (swatchColors.length - 1)) * 100
        return `${color} ${percentage}%`
      }).join(', ')

  useEffect(() => {
    const fetchOEmbed = async (url: string) => {
      try {
        setLoading(true)
        onNodeUpdate?.(id, { status: 'loading' })
        const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const res = await fetch(endpoint)
        if (!res.ok) throw new Error('oEmbed failed')
        const json = await res.json()
        const title = (json?.title as string) || data.title || 'Video'
        const thumb = (json?.thumbnail_url as string) || ''
        onNodeUpdate?.(id, { title, thumbnailUrl: thumb, status: 'ready' })
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

  const videoId = extractYouTubeId(data.videoUrl)
  const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : ''

  const containerWidthClass = expanded ? 'w-[820px]' : 'w-[260px]'

  return (
    <div className={getNodeContainerClasses({ selected, isLocked, isLockedByMe, receiveMode: false, extra: containerWidthClass })}>
      {/* Colorgory ring overlay (hidden when expanded) */}
      {!expanded && swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            padding: 3,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}

      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="cursor-default">
        {!expanded ? (
          <div className="relative w-full" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>
            {data.thumbnailUrl ? (
              <img src={data.thumbnailUrl} alt={data.title || 'Video'} className="w-full h-[160px] rounded-md object-cover cursor-pointer" />
            ) : (
              <div className="w-full h-[160px] rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                {loading ? 'Loading…' : 'No thumbnail'}
              </div>
            )}
            <div className="absolute bottom-1 left-1">
              <IconButton variant="default" size="sm" aria-label="Expand video" onClick={(e) => { e.stopPropagation(); setExpanded(true) }}>
                <ArrowsOut size={14} />
              </IconButton>
            </div>
          </div>
        ) : (
          <div className="relative w-full">
            {embedSrc ? (
              <div className="w-[800px] h-[450px] bg-black rounded-md overflow-hidden">
                <iframe
                  width="800"
                  height="450"
                  src={embedSrc}
                  title={data.title || 'YouTube video'}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="w-[800px] h-[450px] bg-gray-900 text-gray-100 rounded-md flex items-center justify-center">No video URL</div>
            )}
            <div className="absolute bottom-1 left-1">
              <IconButton variant="default" size="sm" aria-label="Minimize video" onClick={(e) => { e.stopPropagation(); setExpanded(false) }}>
                <ArrowsIn size={14} />
              </IconButton>
            </div>
          </div>
        )}
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{data.title || 'Video'}</div>
          {data.videoUrl && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{data.videoUrl}</div>
          )}
        </div>
      </div>

      {!expanded && (
        <NodeActionDrawer>
        <ColorgoryQuickMenu
          nodeId={id}
          selectedIds={(data as any).colorgoryIds || []}
          onChange={(next) => onNodeUpdate?.(id, { colorgoryIds: next })}
          disabled={isLocked && !isLockedByMe}
          onNodeUpdate={onNodeUpdate}
        />
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete node"
          onClick={(e) => { e.stopPropagation(); onNodeDelete?.(id) }}
          disabled={isLocked && !isLockedByMe}
        >
          <Trash size={14} />
        </IconButton>
        </NodeActionDrawer>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}


