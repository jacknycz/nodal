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
        stroke="#3b82f6" // Blue color to match your theme
        strokeWidth={3} // Thicker line for better visibility
        className="animated"
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
        style={{
          filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))', // Glow effect
        }}
      />
      
      {/* Secondary line for better visibility */}
      <path
        fill="none"
        stroke="#ffffff" // White outline
        strokeWidth={5} // Thicker outline
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
        style={{
          filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))',
        }}
      />
      
      {/* Target circle */}
      <circle 
        cx={toX} 
        cy={toY} 
        fill="#3b82f6" // Blue fill
        r={4} // Slightly larger
        stroke="#ffffff" // White border
        strokeWidth={2}
        style={{
          filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))',
        }}
      />
    </g>
  )
}

export default CustomConnectionLine 