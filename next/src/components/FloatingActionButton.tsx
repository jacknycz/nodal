"use client"

import React from 'react'
import { Plus, RotateCcw, FilePlus } from 'lucide-react'
import IconButton from './ui/IconButton'
import Menu from './ui/Menu'

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
  const items = [
    { label: 'Add node', icon: Plus, onClick: () => onAddNode() },
    { label: 'Upload document', icon: FilePlus, onClick: () => onUploadDocument() },
    ...(aiInitialized ? [{ label: 'AI generate', onClick: () => onAIGenerate() }] : []),
    ...(onReorganize && nodeCount > 1 ? [{ label: 'Reorganize', icon: RotateCcw, onClick: () => onReorganize?.() }] : []),
  ]

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
      <Menu
        trigger={
          <IconButton
            aria-label="Quick Actions"
            size="lg"
            className="w-14 h-14 bg-gray-800 hover:bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
          >
            <Plus className="w-6 h-6" />
          </IconButton>
        }
        items={items}
        fixedCenterAbove
        width="w-56"
      />
    </div>
  )
}