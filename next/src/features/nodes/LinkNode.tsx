'use client'

import React, { useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash } from '@phosphor-icons/react/ssr'
import { Pencil } from '@phosphor-icons/react'
import IconButton from '../../components/ui/IconButton'
import { useBoardStore } from '../board/boardSlice'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
import NodeActionDrawer from './NodeActionDrawer'
import ColorgoryQuickMenu from './ColorgoryQuickMenu'
import Modal from '../../components/ui/Modal'
import TextInput from '../../components/ui/TextInput'
import TextArea from '../../components/ui/TextArea'
import Button from '../../components/ui/Button'

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
  // Locking
  isNodeLocked?: (nodeId: string) => boolean
  isNodeLockedByMe?: (nodeId: string) => boolean
}

export default function LinkNode({ data, id, selected, onNodeDelete, onNodeUpdate, isNodeLocked, isNodeLockedByMe }: LinkNodeProps) {
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

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
    const fetchPreview = async (url: string) => {
      try {
        setLoading(true)
        onNodeUpdate?.(id, { status: 'loading' })
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        if (!res.ok) throw new Error('preview failed')
        const json = await res.json()
        const title = (json?.title as string) || data.title || new URL(url).hostname
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
    if (data.linkUrl && (data.status !== 'ready' || !data.thumbnailUrl || !data.title)) {
      fetchPreview(data.linkUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.linkUrl])

  const containerWidthClass = 'w-[260px]'

  return (
    <div className={getNodeContainerClasses({ selected, isLocked, isLockedByMe, receiveMode: false, extra: containerWidthClass })}>
      {/* Colorgory ring overlay */}
      {swatchColors.length > 0 && (
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
        <div className="relative w-full">
          {data.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.thumbnailUrl} alt={data.title || 'Link'} className="w-full h-[140px] rounded-md object-cover" />
          ) : (
            <div className="w-full h-[140px] rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
              {loading ? 'Loading…' : 'No preview'}
            </div>
          )}
        </div>
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
            {Boolean((data as any).faviconUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(data as any).faviconUrl} alt="favicon" className="w-4 h-4 rounded-sm flex-shrink-0" />
            )}
            <span className="truncate">{data.title || (data.linkUrl ? new URL(data.linkUrl).hostname : 'Link')}</span>
          </div>
          {data.linkUrl && (
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
          {data.description && (
            <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              {data.description.length > 200 ? `${data.description.slice(0, 200)}…` : data.description}
            </div>
          )}
        </div>
      </div>

      <NodeActionDrawer>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Edit link"
          onClick={(e) => { e.stopPropagation(); setShowEditModal(true) }}
          disabled={isLocked && !isLockedByMe}
        >
          <Pencil size={14} />
        </IconButton>
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

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Link"
        description="Update the link title and description. To change the URL, create a new node."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={() => {
              const titleInput = (document.getElementById(`link-edit-title-${id}`) as HTMLInputElement | null)
              const descInput = (document.getElementById(`link-edit-desc-${id}`) as HTMLTextAreaElement | null)
              const nextTitle = titleInput?.value?.trim() || data.title || (data.linkUrl ? new URL(data.linkUrl).hostname : 'Link')
              const nextDesc = descInput?.value?.trim() || ''
              onNodeUpdate?.(id, { title: nextTitle, description: nextDesc })
              setShowEditModal(false)
            }}>Save</Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <TextInput
            id={`link-edit-title-${id}`}
            label="Title"
            defaultValue={data.title || (data.linkUrl ? new URL(data.linkUrl).hostname : '')}
            fullWidth
          />
          <TextArea
            id={`link-edit-desc-${id}`}
            label="Description"
            defaultValue={data.description || ''}
            rows={3}
            fullWidth
          />
          {data.linkUrl && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              URL: {data.linkUrl}
            </div>
          )}
        </div>
      </Modal>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}


