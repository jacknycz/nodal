'use client'

import React, { useState } from 'react'
import { 
  Grid, 
  Circle, 
  ArrowRight, 
  Zap, 
  RotateCcw, 
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useBoardReorganization } from '../features/board/usePlacement'
import { LayoutAlgorithm } from '../features/board/placementTypes'

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
    description: 'Organize nodes in a clean, structured grid',
    icon: Grid,
    bestFor: 'Structured content, categories, systematic organization',
    recommended: true
  },
  {
    id: LayoutAlgorithm.RADIAL,
    name: 'Radial Layout', 
    description: 'Arrange nodes in concentric circles',
    icon: Circle,
    bestFor: 'Hierarchical content, central themes with branches'
  },
  {
    id: LayoutAlgorithm.LINEAR,
    name: 'Linear Layout',
    description: 'Place nodes in a straight line or sequence',
    icon: ArrowRight,
    bestFor: 'Timelines, processes, step-by-step content'
  },
  {
    id: LayoutAlgorithm.SPIRAL,
    name: 'Spiral Layout',
    description: 'Create an organic spiral pattern',
    icon: Zap,
    bestFor: 'Creative layouts, brainstorming, organic flow'
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
        
        // Auto-close after success
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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <RotateCcw className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Reorganize Board
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose a layout to reorganize your {nodeCount} nodes
              </p>
            </div>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`m-6 p-4 rounded-lg flex items-center gap-3 ${
            result.success 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {result.success ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{result.message}</span>
          </div>
        )}

        {/* Layout Options */}
        <div className="p-6 space-y-4">
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
                      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
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
                        <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                          Recommended
                        </span>
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

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Sparkles className="w-4 h-4" />
              <span>Powered by intelligent placement algorithms</span>
            </div>
            
            <button
              onClick={onClose}
              disabled={isReorganizing}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReorganizing ? 'Reorganizing...' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
