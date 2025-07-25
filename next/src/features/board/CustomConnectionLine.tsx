'use client'

import React from 'react'
import { getBezierPath } from '@xyflow/react'

interface CustomConnectionLineProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export default function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: CustomConnectionLineProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: undefined,
    targetX: toX,
    targetY: toY,
    targetPosition: undefined,
  })

  return (
    <path
      d={edgePath}
      stroke="#3b82f6"
      strokeWidth={3}
      fill="none"
      className="react-flow__connection-line"
    />
  )
} 