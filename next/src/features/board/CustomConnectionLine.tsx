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
      <path
        fill="none"
        stroke="#222"
        strokeWidth={2}
        className="animated"
        d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
      />
      <circle cx={toX} cy={toY} fill="#fff" r={3} stroke="#222" strokeWidth={1.5} />
    </g>
  )
}

export default CustomConnectionLine 