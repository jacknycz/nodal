"use client"

import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'

type HeadlineSize = 'sm' | 'md' | 'lg' | 'xl'

export interface HeadlineNodeData {
  title?: string
  titleSize?: HeadlineSize
}

interface HeadlineNodeProps {
  id: string
  data: HeadlineNodeData
  selected?: boolean
}

export default function HeadlineNode({ data }: HeadlineNodeProps) {
  const size: HeadlineSize = (data?.titleSize as HeadlineSize) || 'sm'
  const titleHtml = (data?.title && String(data.title).trim()) ? String(data.title) : '<p>New headline</p>'

  const sizeClass = size === 'lg' ? 'text-[72px]' : size === 'md' ? 'text-[64px]' : size === 'xl' ? 'text-[96px]' : 'text-[48px]'

  return (
    <div className="pointer-events-auto flex bg-transparent relative group">
      <Handle
        type="target"
        position={Position.Top}
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />
      <div
        className={`tiptap-content wrap-break-word flex !leading-tight ${sizeClass} select-text`}
        style={{ color: 'var(--board-headline-color)' }}
        // Headline content is authored by TipTap (stored as HTML).
        // This is internal user content; we render it directly for inline styling + text-align support.
        dangerouslySetInnerHTML={{ __html: titleHtml }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />
    </div>
  )
}


