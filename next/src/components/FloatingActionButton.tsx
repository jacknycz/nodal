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
    { label: 'Add node(s)', icon: Plus, nativeClick: true, onClick: () => { console.log('[FAB] Add node(s) clicked - invoking onAddNode'); try { onAddNode(); } catch (e) { console.error('[FAB] onAddNode threw', e) } } },
    { label: 'Upload document', icon: FilePlus, nativeClick: true, onClick: onUploadDocument },
    ...(onReorganize && nodeCount > 1 ? [{ label: 'Reorganize', icon: ClockCounterClockwise, nativeClick: true, onClick: onReorganize }] : []),
  ]

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20">
      <Menu
        trigger={
          <IconButton
            aria-label="Open Actions"
            size="lg"
            className="w-14 h-14 bg-white/70 border border-gray-200/50 dark:border-none dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center"
          >
            <img src="/nodal.svg" alt="Nodal" className="w-8 h-8" />
          </IconButton>
        }
        items={items}
        fixedCenterAbove
        openOnHover={false}
        width="w-56"
      />
    </div>
  )
}