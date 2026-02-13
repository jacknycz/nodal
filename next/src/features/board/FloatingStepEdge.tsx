'use client'

import React, { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, useReactFlow } from '@xyflow/react'
import { ArrowClockwise, X } from '@phosphor-icons/react'
import { useBoardStore } from './boardSlice'
import IconButton from '../../components/ui/IconButton'
import Checkbox from '../../components/ui/Checkbox'

interface FloatingEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data?: { label?: string; type?: 'ai' | 'focus' | 'default'; showDirection?: boolean }
  selected?: boolean
  animated?: boolean
  onEdgeDelete?: (edgeId: string) => void
  onEdgeUpdate?: (edgeId: string, patch: Record<string, any>) => void
  onEdgeReverse?: (edgeId: string) => void
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
  onEdgeUpdate,
  onEdgeReverse,
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

  const [anchors, setAnchors] = useState<{ sx: number; sy: number; tx: number; ty: number; sp: Position; tp: Position } | null>(null)

  useLayoutEffect(() => {
    let r1 = 0
    let r2 = 0
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const a = computeAnchors()
        setAnchors(a)
      })
    })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, target, rf, sourceX, sourceY, targetX, targetY])

  useEffect(() => {
    if (!source || !target) return
    const sel = document.querySelector(`.react-flow__node[data-id="${source}"]`) as HTMLElement | null
    const tel = document.querySelector(`.react-flow__node[data-id="${target}"]`) as HTMLElement | null
    if (!sel || !tel) return
    const observer = new MutationObserver(() => {
      const a = computeAnchors()
      setAnchors(a)
    })
    observer.observe(sel, { attributes: true, attributeFilter: ['style'] })
    observer.observe(tel, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, target])

  const sx = anchors ? anchors.sx : sourceX
  const sy = anchors ? anchors.sy : sourceY
  const tx = anchors ? anchors.tx : targetX
  const ty = anchors ? anchors.ty : targetY
  const sp = anchors ? anchors.sp : sourcePosition
  const tp = anchors ? anchors.tp : targetPosition

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

  const showDirection = !!(data as any)?.showDirection
  const gradientId = `edge-dir-grad-${id}`
  const arrowId = `edge-dir-arrow-${id}`

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={getEdgeStyle()} className={`edge-${data?.type || 'default'} ${selected ? 'selected' : ''} ${animated ? 'animated' : ''}`} />

      {/* Direction overlay (arrowhead + subtle pulse) */}
      {showDirection && (
        <>
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={tx} y2={ty}>
              <stop offset="0%" stopColor="var(--edge-default-color)" stopOpacity="0.06" />
              <stop offset="60%" stopColor="var(--edge-ai-color)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--edge-default-color)" stopOpacity="0.06" />
            </linearGradient>
            <marker id={arrowId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--edge-ai-color)" opacity="0.9" />
            </marker>
          </defs>
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={selected ? 4 : 3}
            strokeLinecap="round"
            className="edge-direction-pulse"
            markerEnd={`url(#${arrowId})`}
            pointerEvents="none"
            opacity={0.85}
          />
        </>
      )}

      <path d={edgePath} fill="none" stroke="transparent" strokeWidth="20" style={{ cursor: 'pointer' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="nodrag nopan" />
      {isHovered && onEdgeDelete && (
        <EdgeLabelRenderer>
          <div
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${centerX}px,${centerY}px)`, pointerEvents: 'all', zIndex: 1000 }}
            className="nodrag nopan"
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
            onMouseDown={(e) => { e.stopPropagation() }}
            onClick={(e) => { e.stopPropagation() }}
          >
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-lg">
              <Checkbox
                size="sm"
                shape="circle"
                label="Dir"
                labelTextClassName="text-[11px] text-gray-700 dark:text-gray-200"
                checked={showDirection}
                onChange={(checked, e) => {
                  e.stopPropagation()
                  onEdgeUpdate?.(id, { showDirection: checked })
                }}
              />
              <IconButton
                aria-label="Reverse direction"
                title={showDirection ? 'Reverse direction' : 'Enable Dir to reverse'}
                variant="secondaryGhost"
                size="xs"
                disabled={!showDirection}
                onMouseDown={(e) => { e.stopPropagation() }}
                onClick={(e) => { e.stopPropagation(); onEdgeReverse?.(id) }}
              >
                <ArrowClockwise size={14} weight="duotone" />
              </IconButton>
              <IconButton
                aria-label="Delete connection"
                title="Delete connection"
                variant="dangerGhost"
                size="xs"
                onMouseDown={(e) => { e.stopPropagation() }}
                onClick={handleDelete}
                className="delete-button-enter"
              >
                <X size={14} weight="duotone" />
              </IconButton>
            </div>
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


