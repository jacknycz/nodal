'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, TreeView, Play, CheckCircle, CheckFat, DotsThreeOutlineVertical } from '@phosphor-icons/react/ssr'
import { Pencil } from '@phosphor-icons/react'
import IconButton from '../../components/ui/IconButton'
import { useBoardStore } from '../board/boardSlice'
import { getColorgoryHex } from '../board/colorgoryColors'
import { FORCE_UI_TEXT_VARS_CLASS, getNodeContainerClasses, NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'
import { useTheme } from '../../contexts/ThemeContext'
 
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import NodeEditModal from '../../components/NodeEditModal'
import Tooltip from '../../components/ui/Tooltip'

interface LinkNodeData {
  title?: string
  linkUrl?: string
  thumbnailUrl?: string
  description?: string
  status?: 'idle' | 'loading' | 'ready' | 'error'
  colorgoryIds?: string[]
}

interface LinkNodeProps {
  data: LinkNodeData
  id: string
  selected?: boolean
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Partial<LinkNodeData>) => void
  onOrganizeSubtree?: (nodeId: string) => void
  onNodeShiftClickConnect?: (targetId: string) => void
  onStartStoryMode?: (nodeId: string) => void
}

export default function LinkNode({ data, id, selected, onNodeDelete, onNodeUpdate, onOrganizeSubtree, onStartStoryMode }: LinkNodeProps) {
  const { isDark } = useTheme()
  const storyTitle = String((data as any)?.storyTitle || data.title || 'Story')
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
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

  const isValidHttpUrl = (maybeUrl?: string) => {
    if (!maybeUrl) return false
    try {
      const u = new URL(maybeUrl)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  const safeHostname = useMemo(() => {
    if (!data.linkUrl) return 'Link'
    try { return new URL(data.linkUrl).hostname } catch { return 'Link' }
  }, [data.linkUrl])

  useEffect(() => {
    const fetchPreview = async (url: string) => {
      try {
        setLoading(true)
        onNodeUpdate?.(id, { status: 'loading' })
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        if (!res.ok) throw new Error('preview failed')
        const json = await res.json()
        const title = (json?.title as string) || data.title || (isValidHttpUrl(url) ? new URL(url).hostname : 'Link')
        const thumb = (json?.image as string) || (json?.firstImage as string) || ''
        const favicon = (json?.favicon as string) || ''
        const description = (json?.description as string) || data.description || ''
        onNodeUpdate?.(id, { title, thumbnailUrl: thumb, description, status: 'ready', ...(favicon ? { faviconUrl: favicon } : {}) } as any)
      } catch (e) {
        onNodeUpdate?.(id, { status: 'error' })
      } finally {
        setLoading(false)
      }
    }
    if (isValidHttpUrl(data.linkUrl) && (data.status !== 'ready' || !data.thumbnailUrl || !data.title)) {
      fetchPreview(data.linkUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.linkUrl])

  const containerWidthClass = 'w-[260px]'

  const plainDescription = useMemo(() => {
    const raw = data.description || ''
    if (!raw) return ''
    try {
      const div = document.createElement('div')
      div.innerHTML = raw
      return (div.textContent || div.innerText || '').trim()
    } catch { return raw }
  }, [data.description])

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: false, extra: [containerWidthClass, swatchColors.length > 0 ? FORCE_UI_TEXT_VARS_CLASS : ''].filter(Boolean).join(' ') })}
      style={!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : undefined}
    >
      {(data as any)?.storyStarter && (
        <div
          data-story-starter-badge
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-40 flex items-center gap-2 rounded-full border border-primary-200/80 dark:border-primary-800 bg-white/90 dark:bg-gray-900/80 px-2 py-1 shadow-sm backdrop-blur"
          onMouseDown={(e) => { e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation() }}
        >
          {!!(data as any)?.storyCompleted && (
            <span
              className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center p-0.5 rounded-full bg-white dark:bg-gray-900 border border-primary-200/80 dark:border-primary-800 shadow-sm"
              title="Story complete"
            >
              <CheckFat size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
            </span>
          )}
          <IconButton
            variant="secondaryGhost"
            size="xs"
            aria-label="Story settings"
            onMouseDown={(e) => { e.stopPropagation() }}
            onClick={(e) => {
              e.stopPropagation()
              try { window.dispatchEvent(new CustomEvent('nodal:open-story-settings', { detail: { id, title: storyTitle } })) } catch {}
            }}
            title="Story settings"
          >
            <DotsThreeOutlineVertical size={14} weight="duotone" />
          </IconButton>
          <span
            className="max-w-[220px] truncate text-[11px] font-medium text-[var(--board-node-title)]"
            title={storyTitle}
          >
            {storyTitle}
          </span>
          <IconButton
            variant="primaryGhost"
            size="xs"
            aria-label="Play story"
            onMouseDown={(e) => { e.stopPropagation() }}
            onClick={(e) => { e.stopPropagation(); try { onStartStoryMode?.(id) } catch {} }}
            title="Play story"
          >
            <Play size={14} weight="duotone" />
          </IconButton>
        </div>
      )}
      {/* Colorgory ring overlay */}
      {isDark && swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[var(--board-node-radius)]"
          style={{
            padding: 4,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}

      <Handle type="target" position={Position.Top} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />

      <div className="nodal-drag-handle cursor-move">
        <div className="relative w-full">
          {data.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.thumbnailUrl} alt={data.title || 'Link'} className="w-full h-[140px] rounded-md object-cover" />
          )}
        </div>
        <div className="mt-2">
          <div className={`${(data as any).titleSize === 'lg' ? 'text-xl' : (data as any).titleSize === 'md' ? 'text-base' : 'text-sm'} font-medium text-[var(--board-node-title)] truncate flex items-center gap-2`}>
            {Boolean((data as any).faviconUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(data as any).faviconUrl} alt="favicon" className="w-4 h-4 rounded-sm shrink-0" />
            )}
            <span className="truncate">{data.title || safeHostname}</span>
          </div>

          {isValidHttpUrl(data.linkUrl) && (
            <a
              href={data.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate inline-block w-full"
              onClick={(e) => e.stopPropagation()}
              title={data.linkUrl}
            >
              {data.linkUrl}
            </a>
          )}
          {plainDescription && (
            <div className="mt-2 text-xs text-[var(--board-node-content)] leading-relaxed whitespace-pre-line wrap-break-word line-clamp-2">
              {plainDescription.length > 200 ? `${plainDescription.slice(0, 200)}…` : plainDescription}
            </div>
          )}
        </div>
      </div>

      

      {showEditModal && (
        <NodeEditModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={(title, content) => { onNodeUpdate?.(id, { title, description: content }); setShowEditModal(false) }}
          onLiveChange={(title, content) => { onNodeUpdate?.(id, { title, description: content }) }}
          initialTitle={data.title || safeHostname || ''}
          initialContent={data.description || ''}
          initialColorgoryIds={(data as any).colorgoryIds || []}
          initialTitleSize={'sm'}
          initialPageMode={false}
        />
      )}

      <Handle type="source" position={Position.Bottom} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />
    </div>
  )
}


