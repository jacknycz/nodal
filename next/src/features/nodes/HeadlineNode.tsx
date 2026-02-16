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
  const title = data?.title || 'New headline'

  const sizeClass = size === 'lg' ? 'text-[72px]' : size === 'md' ? 'text-[64px]' : size === 'xl' ? 'text-[96px]' : 'text-[48px]'

  return (
    <div className="pointer-events-auto flex bg-transparent relative group">
      <Handle
        type="target"
        position={Position.Top}
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />
      <div className={`font-bold whitespace-pre-wrap wrap-break-word flex leading-tight ${sizeClass} text-gray-900 dark:text-white select-text`}>
        {title}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />
    </div>
  )
}


