import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { Heading } from 'pres-start-core'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'

export default function NodalNode({ data }: NodeProps) {
  const nodeData = data as unknown as BoardNode['data']
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-lg border border-gray-200">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      {/* Drag Handle */}
      <div className="nodal-drag-handle cursor-move mb-2 p-2 -m-2 hover:bg-gray-50 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          </div>
          <div className="text-xs text-gray-400">drag</div>
        </div>
      </div>
      
      <div className="space-y-2">
        <Heading size="h4">{nodeData.label}</Heading>
        {nodeData.content && (
          <p className="text-sm text-gray-600">
            {nodeData.content}
          </p>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
} 