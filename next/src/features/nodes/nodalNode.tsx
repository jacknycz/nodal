'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'

interface NodalNodeProps {
  data: {
    label: string
    title?: string
    content?: string
    type?: string
    expanded?: boolean
    aiGenerated?: boolean
  }
}

export default function NodalNode({ data }: NodalNodeProps) {
  // Use label as the primary title, fallback to title if label doesn't exist
  const displayTitle = data.label || data.title || 'Untitled'
  
  return (
    <div className="flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[640px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
          {displayTitle}
        </h3>
        {data.content && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {data.content}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}
