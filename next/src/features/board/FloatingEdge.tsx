'use client'

import React, { useState, useRef } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from '@xyflow/react'
import { X } from 'lucide-react'
import { useBoardStore } from './boardSlice'

interface FloatingEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data?: {
    label?: string
    type?: 'ai' | 'focus' | 'default'
  }
  selected?: boolean
  animated?: boolean
  onEdgeDelete?: (edgeId: string) => void
  // Provided by React Flow for custom edges
  source?: string
  target?: string
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
  selected = false,
  animated = false,
  onEdgeDelete,
  source,
  target,
}: FloatingEdgeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const selectedNodeIds: string[] = useBoardStore((s: any) => s.selectedNodeIds || [])
  const isInConnectionMode = !!connectingSourceId
  const isRelatedToSource = isInConnectionMode && (source === connectingSourceId || target === connectingSourceId)
  const hasSelection = Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
  const isRelatedToSelection = hasSelection && (selectedNodeIds.includes(source as string) || selectedNodeIds.includes(target as string))

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Calculate center point for delete button
  const centerX = (sourceX + targetX) / 2
  const centerY = (sourceY + targetY) / 2

  // Debug logging
  // console.log('FloatingEdge render:', { id, isHovered, selected, onEdgeDelete: !!onEdgeDelete })

  // Dynamic styling based on edge type and state
  const getEdgeStyle = () => {
    const opacity = isInConnectionMode
      ? (isRelatedToSource ? 1 : 0.2)
      : hasSelection
        ? (isRelatedToSelection ? 1 : 0.2)
        : 1

    const baseStyle = {
      strokeWidth: selected ? 2 : 2,
      transition: 'all 0.2s ease',
      opacity,
    } as React.CSSProperties

    switch (data?.type) {
      case 'ai':
        return {
          ...baseStyle,
          stroke: '#3b82f6',
          strokeDasharray: animated ? '5,5' : 'none',
          filter: selected && (!isInConnectionMode || isRelatedToSource) ? 'drop-shadow(0 0 8px #3b82f6)' : 'none',
        }
      case 'focus':
        return {
          ...baseStyle,
          stroke: '#10b981',
          strokeWidth: selected ? 5 : 3,
          filter: selected && (!isInConnectionMode || isRelatedToSource) ? 'drop-shadow(0 0 8px #10b981)' : 'none',
        }
      default:
        return {
          ...baseStyle,
          stroke: '#6b7280',
          filter: selected && (!isInConnectionMode || isRelatedToSource) ? 'drop-shadow(0 0 8px #6b7280)' : 'none',
        }
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('Delete button clicked for edge:', id)
    onEdgeDelete?.(id)
  }

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    console.log('Edge hover enter:', id)
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    // Add a small delay before hiding to prevent flicker
    hoverTimeoutRef.current = setTimeout(() => {
      console.log('Edge hover leave:', id)
      setIsHovered(false)
    }, 100) // 100ms delay
  }

  const handleButtonMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setIsHovered(true)
  }

  const handleButtonMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 100)
  }

  return (
    <>
      {/* Visible edge */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={getEdgeStyle()}
        className={`edge-${data?.type || 'default'} ${selected ? 'selected' : ''} ${animated ? 'animated' : ''}`}
      />
      
      {/* Invisible interactive path for mouse events */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        style={{ cursor: 'pointer' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="nodrag nopan"
      />
      
      {/* Delete Button */}
      {isHovered && onEdgeDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${centerX}px,${centerY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            <button
              onClick={handleDelete}
              className="flex items-center justify-center w-6 h-6 bg-tertiary-900 hover:bg-tertiary-600 text-white cursor-pointer rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-300 border-2 border-white delete-button-enter"
              title="Delete connection"
              aria-label="Delete connection"
            >
              <X size={14} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Edge Label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
              backgroundColor: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
} 