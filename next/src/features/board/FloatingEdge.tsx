'use client'

import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'

interface FloatingEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: any
  targetPosition: any
  data?: any
}

export default function FloatingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: FloatingEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
} 