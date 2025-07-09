import React from 'react'
import { getBezierPath } from '@xyflow/react'
import type { ConnectionLineComponentProps } from '@xyflow/react'

export default function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  })

  return (
    <g>
      <path
        d={edgePath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={3}
        strokeDasharray="5,5"
        style={connectionLineStyle}
        className="animated"
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#3b82f6"
        r={3}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  )
} 