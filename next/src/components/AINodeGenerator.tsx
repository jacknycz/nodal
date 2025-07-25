'use client'

import React, { useState } from 'react'
import { useUnifiedAI } from '../features/ai/useUnifiedAI'
import { X, Sparkles, Loader2, Plus, Settings } from 'lucide-react'
import type { BoardNode } from '../features/board/boardTypes'

interface AINodeGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onGenerate?: (nodes: BoardNode[]) => void
  existingNodes?: BoardNode[]
}

export default function AINodeGenerator({ 
  isOpen, 
  onClose, 
  onGenerate,
  existingNodes = []
}: AINodeGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [nodeCount, setNodeCount] = useState(3)
  const [temperature, setTemperature] = useState(0.8)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const {
    generateNodes,
    isGeneratingNodes,
    error,
    clearError,
    updateContext
  } = useUnifiedAI()

  // Update context with existing nodes
  React.useEffect(() => {
    if (existingNodes.length > 0) {
      updateContext({
        board: {
          nodes: existingNodes,
          edges: [],
          selectedNodeId: null,
          focusedNodeIds: [],
          boardSummary: `Board with ${existingNodes.length} existing nodes`
        }
      })
    }
  }, [existingNodes, updateContext])

  const handleGenerate = async () => {
    if (!prompt.trim() || isGeneratingNodes) return

    try {
      const result = await generateNodes({
        prompt: prompt.trim(),
        count: nodeCount,
        context: {
          existingNodes,
          topic: `Generating ${nodeCount} nodes for: ${prompt}`
        }
      })

      if (onGenerate && result.nodes.length > 0) {
        onGenerate(result.nodes)
      }

      // Reset form
      setPrompt('')
      onClose()
    } catch (err) {
      console.error('Failed to generate nodes:', err)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                AI Node Generator
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate nodes with AI assistance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What kind of nodes would you like to generate?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., 'Generate nodes for a project about sustainable energy' or 'Create nodes for brainstorming marketing ideas'"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              rows={3}
            />
          </div>

          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Nodes
              </label>
              <select
                value={nodeCount}
                onChange={(e) => setNodeCount(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Creativity
              </label>
              <select
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={0.3}>Focused</option>
                <option value={0.6}>Balanced</option>
                <option value={0.8}>Creative</option>
                <option value={1.0}>Very Creative</option>
              </select>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <Settings className="w-4 h-4" />
              <span>Advanced Settings</span>
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Context from Existing Nodes
                </label>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {existingNodes.length > 0 ? (
                    <div>
                      <p>Using {existingNodes.length} existing nodes as context:</p>
                      <ul className="mt-1 space-y-1">
                        {existingNodes.slice(0, 3).map(node => (
                          <li key={node.id} className="text-xs">
                            • {node.data.title}
                          </li>
                        ))}
                        {existingNodes.length > 3 && (
                          <li className="text-xs text-gray-500">
                            • ... and {existingNodes.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p>No existing nodes to use as context</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Tips for better results:
            </h4>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Be specific about the topic or domain</li>
              <li>• Mention the type of nodes you want (ideas, tasks, concepts, etc.)</li>
              <li>• Reference existing nodes if you want related content</li>
              <li>• Use Ctrl+Enter to generate quickly</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGeneratingNodes}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingNodes ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Generate Nodes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 