'use client'

import React, { useState } from 'react'
import { 
  GridFour,
  ClockCounterClockwise,
  Sparkle,
  Spinner,
  CheckCircle,
  Warning
} from '@phosphor-icons/react'
import { useBoardReorganization } from '../features/board/usePlacement'
import { LayoutAlgorithm } from '../features/board/placementTypes'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Tag from './ui/Tag'
import { useBoardStore } from '../features/board/boardSlice'

interface BoardReorganizeMenuProps {
  isOpen: boolean
  onClose: () => void
  nodeCount: number
}

interface LayoutOption {
  id: LayoutAlgorithm
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  bestFor: string
  recommended?: boolean
}

const layoutOptions: LayoutOption[] = [
  {
    id: LayoutAlgorithm.GRID,
    name: 'Grid Layout',
    description: 'Reorganize nodes into a clean, tiered grid by parent/child rows',
    icon: GridFour,
    bestFor: 'Most boards; families grouped by parent across rows',
    recommended: true
  }
]

export default function BoardReorganizeMenu({ 
  isOpen, 
  onClose, 
  nodeCount 
}: BoardReorganizeMenuProps) {
  const [isReorganizing, setIsReorganizing] = useState(false)
  const [selectedLayout, setSelectedLayout] = useState<LayoutAlgorithm | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const { reorganizeBoardLayout } = useBoardReorganization()
  const totalNodes = useBoardStore((s) => (s.nodes || []).length)
  const scopeLabel = (totalNodes > 0 && nodeCount >= totalNodes) ? 'ALL' : String(nodeCount)

  const handleReorganize = async (algorithm: LayoutAlgorithm) => {
    setIsReorganizing(true)
    setSelectedLayout(algorithm)
    setResult(null)

    try {
      const placementResult = await reorganizeBoardLayout(algorithm, true, {
        minDistance: 40,
        avoidOverlap: true,
        preferredDirection: 'auto'
      })

      if (placementResult.success) {
        setResult({
          success: true,
          message: `Successfully reorganized ${placementResult.placements.length} nodes using ${algorithm} layout!`
        })
        setTimeout(() => {
          onClose()
          setResult(null)
          setSelectedLayout(null)
        }, 2000)
      } else {
        setResult({
          success: false,
          message: `Reorganization failed: ${placementResult.warnings.join(', ')}`
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Error during reorganization: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsReorganizing(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => { if (!isReorganizing) onClose() }}
      title="Reorganize Board"
      description={`Apply grid layout to reorganize your ${scopeLabel} nodes`}
      actions={
        <Button onClick={onClose} disabled={isReorganizing}>
          {isReorganizing ? 'Reorganizing...' : 'Close'}
        </Button>
      }
    >
      <div className="mb-4 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300 flex items-center gap-2">
        <Warning weight="duotone" className="w-4 h-4" />
        <span className="text-sm font-medium">ALERT: This will reorganize {scopeLabel} nodes on the board.</span>
      </div>
      {/* Result Message */}
      {result && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          result.success 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {result.success ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Warning className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{result.message}</span>
        </div>
      )}

      {/* Layout Options */}
      <div className="space-y-4">
        {layoutOptions.map((option) => {
          const Icon = option.icon
          const isSelected = selectedLayout === option.id
          const isProcessing = isReorganizing && isSelected

          return (
            <button
              key={option.id}
              onClick={() => !isReorganizing && handleReorganize(option.id)}
              disabled={isReorganizing}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                isSelected && isReorganizing
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${
                isReorganizing && !isSelected
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  isSelected && isReorganizing
                    ? 'bg-primary-100 dark:bg-primary-800'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {isProcessing ? (
                    <Spinner className="w-6 h-6 text-primary-600 animate-spin" />
                  ) : (
                    <Icon className={`w-6 h-6 ${
                      isSelected && isReorganizing
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {option.name}
                    </h3>
                    {option.recommended && (
                      <Tag variant="primary">Recommended</Tag>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {option.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    <strong>Best for:</strong> {option.bestFor}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
