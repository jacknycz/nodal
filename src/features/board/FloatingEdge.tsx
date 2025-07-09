import React from 'react'
import { useStore, getBezierPath, Position } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

// Returns the position (top, right, bottom, left) passed node compared to the other node
function getNodeIntersection(intersectionNode: any, otherNode: any) {
  const intersectionNodeWidth = intersectionNode.measured?.width
  const intersectionNodeHeight = intersectionNode.measured?.height
  const intersectionNodePosition = intersectionNode.internals?.positionAbsolute
  const otherNodePosition = otherNode.internals?.positionAbsolute

  // Check if required properties exist
  if (!intersectionNodePosition || !otherNodePosition || 
      !intersectionNodeWidth || !intersectionNodeHeight) {
    return { x: 0, y: 0 }
  }

  const w = intersectionNodeWidth / 2
  const h = intersectionNodeHeight / 2

  const x2 = intersectionNodePosition.x + w
  const y2 = intersectionNodePosition.y + h
  const x1 = otherNodePosition.x + w
  const y1 = otherNodePosition.y + h

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1))
  const xx3 = a * xx1
  const yy3 = a * yy1
  const x = w * (xx3 + yy3) + x2
  const y = h * (-xx3 + yy3) + y2

  return { x, y }
}

// Returns the position of the node handle
function getNodeHandle(node: any, handlePosition: Position) {
  const width = node.measured?.width
  const height = node.measured?.height
  const positionAbsolute = node.internals?.positionAbsolute

  // Check if required properties exist
  if (!positionAbsolute || !width || !height) {
    return { x: 0, y: 0 }
  }

  switch (handlePosition) {
    case Position.Left:
      return {
        x: positionAbsolute.x,
        y: positionAbsolute.y + height / 2,
      }
    case Position.Right:
      return {
        x: positionAbsolute.x + width,
        y: positionAbsolute.y + height / 2,
      }
    case Position.Top:
      return {
        x: positionAbsolute.x + width / 2,
        y: positionAbsolute.y,
      }
    case Position.Bottom:
      return {
        x: positionAbsolute.x + width / 2,
        y: positionAbsolute.y + height,
      }
    default:
      return {
        x: positionAbsolute.x + width / 2,
        y: positionAbsolute.y + height / 2,
      }
  }
}

function getEdgePosition(node: any, otherNode: any) {
  // Check if nodes have required properties
  if (!node || !otherNode) {
    return [{ x: 0, y: 0 }, { x: 0, y: 0 }]
  }

  const n1 = getNodeIntersection(node, otherNode)
  const n2 = getNodeIntersection(otherNode, node)

  return [n1, n2]
}

export default function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
}: EdgeProps) {
  
  const sourceNode = useStore((store) => store.nodeLookup.get(source))
  const targetNode = useStore((store) => store.nodeLookup.get(target))

  if (!sourceNode || !targetNode) {
    return null
  }

  const [sourcePosition, targetPosition] = getEdgePosition(sourceNode, targetNode)

  const [edgePath] = getBezierPath({
    sourceX: sourcePosition.x,
    sourceY: sourcePosition.y,
    targetX: targetPosition.x,
    targetY: targetPosition.y,
  })

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      fill="none"
      markerEnd={markerEnd}
      style={style}
    />
  )
} 