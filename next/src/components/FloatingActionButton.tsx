'use client'

import React, { useState } from 'react'
import { Plus, RotateCcw } from 'lucide-react'

interface FloatingActionButtonProps {
  onAddNode: () => void
  onAIGenerate: () => void
  onUploadDocument: () => void
  onReorganize?: () => void
  aiInitialized: boolean
  nodeCount?: number
}

export default function FloatingActionButton({
  onAddNode,
  onAIGenerate,
  onUploadDocument,
  onReorganize,
  aiInitialized,
  nodeCount = 0,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10">
      <div className={`flex flex-col gap-2 transition-all duration-200 ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'}`}>
        <button
          onClick={onAddNode}
          className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Add Node"
        >
          <Plus className="w-5 h-5" />
        </button>
        
        {/* {aiInitialized && (
          <button
            onClick={onAIGenerate}
            className="w-12 h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
            title="AI Generate"
          >
            <span className="text-lg">🤖</span>
          </button>
        )} */}
        
        <button
          onClick={onUploadDocument}
          className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Upload Document"
        >
          <span className="text-lg">📄</span>
        </button>
        
        {onReorganize && nodeCount > 1 && (
          <button
            onClick={onReorganize}
            className="w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
            title={`Reorganize ${nodeCount} nodes`}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gray-800 hover:bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
        title="Quick Actions"
      >
        <Plus className={`w-6 h-6 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>
    </div>
  )
} 