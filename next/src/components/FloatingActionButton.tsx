"use client"

import React from 'react'
import { Plus, ClockCounterClockwise, FilePlus } from '@phosphor-icons/react'
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
    ...(aiInitialized ? [{ label: 'AI generate', icon: Plus, onClick: () => onAIGenerate() }] : []),
    ...(onReorganize && nodeCount > 1 ? [{ label: 'Reorganize', icon: ClockCounterClockwise, onClick: () => onReorganize?.() }] : []),
    
  ]

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
      <Menu
        trigger={
          <IconButton
            aria-label="Quick Actions"
            size="lg"
            className="w-14 h-14 bg-gray-800 hover:bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 group relative"
          >
            <img src="/nodal.svg" alt="Nodal" className="w-8 h-8" />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <circle cx="7" cy="12" r="2" className="fill-current text-cyan-400 animate-pulse" style={{ animationDelay: '0s', animationDuration: '0.9s' }} />
                <circle cx="12" cy="12" r="2" className="fill-current text-yellow-400 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '0.9s' }} />
                <circle cx="17" cy="12" r="2" className="fill-current text-pink-500 animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '0.9s' }} />
              </g>
            </svg>
          </IconButton>
        }
        items={items}
        fixedCenterAbove
        width="w-56"
      />
    </div>
  )
}