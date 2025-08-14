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
      {/* Main connection line */}
      <path
        fill="none"
        stroke="var(--edge-ai-color)" // Uses CSS variable for theme support
        strokeWidth={3} // Thicker line for better visibility
        className="animated"
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
        style={{
          filter: 'drop-shadow(0 0 4px var(--edge-ai-glow))', // Glow effect
        }}
      />
      
      {/* Secondary line for better visibility */}
      <path
        fill="none"
        stroke="var(--connection-outline)" // Will add this CSS variable
        strokeWidth={5} // Thicker outline
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
        style={{
          filter: 'drop-shadow(0 0 2px var(--connection-outline-glow))',
        }}
      />
      
      {/* Target circle */}
      <circle 
        cx={toX} 
        cy={toY} 
        fill="var(--edge-ai-color)" // Blue fill
        r={4} // Slightly larger
        stroke="var(--connection-outline)" // White border
        strokeWidth={2}
        style={{
          filter: 'drop-shadow(0 0 4px var(--edge-ai-glow))',
        }}
      />
    </g>
  )
}

export default CustomConnectionLine 