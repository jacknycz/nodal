'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'

interface DocumentNodeProps {
  data: {
    title: string
    fileName?: string
    fileType?: string
    documentId?: string
    type?: string
  }
}

export default function DocumentNode({ data }: DocumentNodeProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm p-4 min-w-[200px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          {data.title}
        </h3>
        {data.fileName && (
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {data.fileName}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
} 