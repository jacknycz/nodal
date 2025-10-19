'use client'

import React from 'react'
import { ConnectionLineComponent } from '@xyflow/react'

const CustomConnectionLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  toX,
  toY,
}) => {
  return (
    <g>
      {/* Main connection line (match default edge styling) */}
      <path
        fill="none"
        stroke="var(--edge-default-color)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
        style={{ filter: 'drop-shadow(0 0 6px var(--edge-default-glow))' }}
      />

      {/* Target ring (primary-500, no fill) */}
      <circle
        cx={toX}
        cy={toY}
        r={4.5}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.35))' }}
      />
    </g>
  )
}

export default CustomConnectionLine 