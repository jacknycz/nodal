'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'

interface NodalNodeProps {
  data: {
    title: string
    content?: string
    type?: string
    expanded?: boolean
    aiGenerated?: boolean
  }
}

export default function NodalNode({ data }: NodalNodeProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4 min-w-[200px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          {data.title}
        </h3>
        {data.content && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.content}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
} 