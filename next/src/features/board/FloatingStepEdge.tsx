'use client'

import React, { useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, useReactFlow } from '@xyflow/react'
import { X } from '@phosphor-icons/react'
import { useBoardStore } from './boardSlice'

interface FloatingEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data?: { label?: string; type?: 'ai' | 'focus' | 'default' }
  selected?: boolean
  animated?: boolean
  onEdgeDelete?: (edgeId: string) => void
  source?: string
  target?: string
}

export default function FloatingStepEdge({
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
  const rf = useReactFlow()
  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  // Hover fading removed
  const selectedNodeIds: string[] = useBoardStore((s: any) => s.selectedNodeIds || [])
  const isInConnectionMode = !!connectingSourceId
  const isRelatedToSource = isInConnectionMode && (source === connectingSourceId || target === connectingSourceId)
  const hasContext = (selectedNodeIds || []).length > 0
  const isRelatedToContext = hasContext && (selectedNodeIds.includes(source as string) || selectedNodeIds.includes(target as string))

  const computeAnchors = (): { sx: number; sy: number; tx: number; ty: number; sp: Position; tp: Position } => {
    try {
      if (!source || !target) throw new Error('no ids')
      const sel = document.querySelector(`.react-flow__node[data-id="${source}"]`) as HTMLElement | null
      const tel = document.querySelector(`.react-flow__node[data-id="${target}"]`) as HTMLElement | null
      if (!sel || !tel) throw new Error('no elements')
      const sr = sel.getBoundingClientRect()
      const tr = tel.getBoundingClientRect()
      const sPts = [
        { x: sr.left + sr.width / 2, y: sr.top, pos: Position.Top },
        { x: sr.right, y: sr.top + sr.height / 2, pos: Position.Right },
        { x: sr.left + sr.width / 2, y: sr.bottom, pos: Position.Bottom },
        { x: sr.left, y: sr.top + sr.height / 2, pos: Position.Left },
      ]
      const tPts = [
        { x: tr.left + tr.width / 2, y: tr.top, pos: Position.Top },
        { x: tr.right, y: tr.top + tr.height / 2, pos: Position.Right },
        { x: tr.left + tr.width / 2, y: tr.bottom, pos: Position.Bottom },
        { x: tr.left, y: tr.top + tr.height / 2, pos: Position.Left },
      ]
      let best: any = null
      for (const sp of sPts) {
        const spFlow = rf.screenToFlowPosition({ x: sp.x, y: sp.y })
        for (const tp of tPts) {
          const tpFlow = rf.screenToFlowPosition({ x: tp.x, y: tp.y })
          const dx = spFlow.x - tpFlow.x
          const dy = spFlow.y - tpFlow.y
          const d2 = dx * dx + dy * dy
          if (!best || d2 < best.d2) {
            best = { sx: spFlow.x, sy: spFlow.y, tx: tpFlow.x, ty: tpFlow.y, sp: sp.pos, tp: tp.pos, d2 }
          }
        }
      }
      if (best) return best
      throw new Error('no best')
    } catch {
      return { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY, sp: sourcePosition, tp: targetPosition }
    }
  }

  const { sx, sy, tx, ty, sp, tp } = computeAnchors()

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sp,
    targetX: tx,
    targetY: ty,
    targetPosition: tp,
    borderRadius: 0,
  })

  // Use labelX/labelY from smooth-step path util to align with the actual path midpoint
  const centerX = labelX
  const centerY = labelY

  const getEdgeStyle = () => {
    const isHighlighted = isInConnectionMode ? isRelatedToSource : (hasContext ? isRelatedToContext : true)
    const opacity = 1
    const baseStyle = {
      strokeWidth: selected ? 2 : 2,
      transition: 'all 0.2s ease, filter 0.3s ease',
      opacity,
      willChange: 'filter, opacity',
    } as React.CSSProperties
    switch (data?.type) {
      case 'ai':
        return { ...baseStyle, stroke: 'var(--edge-ai-color)', strokeDasharray: animated ? '5,5' : 'none', filter: selected && isHighlighted ? `drop-shadow(0 0 8px var(--edge-ai-glow))` : 'none' }
      case 'focus':
        return { ...baseStyle, stroke: 'var(--edge-default-color)', strokeWidth: selected ? 3 : 2, filter: selected && isHighlighted ? `drop-shadow(0 0 8px var(--edge-default-glow))` : 'drop-shadow(0 0 8px var(--edge-default-glow))' }
      default:
        return { ...baseStyle, stroke: 'var(--edge-default-color)', filter: selected && isHighlighted ? `drop-shadow(0 0 8px var(--edge-default-glow))` : 'drop-shadow(0 0 8px var(--edge-default-glow))' }
    }
  }

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onEdgeDelete?.(id) }
  const handleMouseEnter = () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setIsHovered(true) }
  const handleMouseLeave = () => { hoverTimeoutRef.current = setTimeout(() => { setIsHovered(false) }, 100) }
  const handleButtonMouseEnter = () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setIsHovered(true) }
  const handleButtonMouseLeave = () => { hoverTimeoutRef.current = setTimeout(() => { setIsHovered(false) }, 100) }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={getEdgeStyle()} className={`edge-${data?.type || 'default'} ${selected ? 'selected' : ''} ${animated ? 'animated' : ''}`} />
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth="20" style={{ cursor: 'pointer' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="nodrag nopan" />
      {isHovered && onEdgeDelete && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${centerX}px,${centerY}px)`, pointerEvents: 'all', zIndex: 1000 }} className="nodrag nopan" onMouseEnter={handleButtonMouseEnter} onMouseLeave={handleButtonMouseLeave}>
            <button onClick={handleDelete} className="flex items-center justify-center w-6 h-6 bg-tertiary-900 hover:bg-tertiary-600 text-white cursor-pointer rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-300 border-2 border-white delete-button-enter" title="Delete connection" aria-label="Delete connection">
              <X size={14} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, fontSize: 12, pointerEvents: 'all', backgroundColor: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} className="nodrag nopan">
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}


