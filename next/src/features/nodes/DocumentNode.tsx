'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'

interface DocumentNodeData {
  label: string
  file?: File
  type: string
}

interface DocumentNodeProps {
  data: DocumentNodeData
}

export default function DocumentNode({ data }: DocumentNodeProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
          <span className="text-blue-600 text-xs">📄</span>
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{data.label}</div>
          <div className="text-xs text-gray-500">{data.type}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
} 