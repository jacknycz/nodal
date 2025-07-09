import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { Heading } from 'pres-start-core'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'

export default function NodalNode({ data }: NodeProps) {
  const nodeData = data as unknown as BoardNode['data']
  
  return (
    <div className="min-w-[200px] p-4 bg-white rounded-lg shadow-lg border border-gray-200">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
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