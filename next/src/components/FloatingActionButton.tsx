"use client"

import React from 'react'
import { Plus, ClockCounterClockwise, Upload, CheckSquare, TextHOne } from '@phosphor-icons/react'
import IconButton from './ui/IconButton'
import Menu from './ui/Menu'

interface FloatingActionButtonProps {
  onAddNode: () => void
  onAIGenerate: () => void
  onUploadDocument: () => void
  onReorganize?: () => void
  onAddTask?: () => void
  onAddHeadline?: () => void
  aiInitialized: boolean
  nodeCount?: number
}

export default function FloatingActionButton({
  onAddNode,
  onAIGenerate,
  onUploadDocument,
  onReorganize,
  onAddTask,
  onAddHeadline,
  aiInitialized,
  nodeCount = 0,
}: FloatingActionButtonProps) {
  const items = [
    { label: 'Add node(s)', icon: Plus, nativeClick: true, onClick: () => { console.log('[FAB] Add node(s) clicked - invoking onAddNode'); try { onAddNode(); } catch (e) { console.error('[FAB] onAddNode threw', e) } } },
    ...(onAddTask ? [{ label: 'Add Task', icon: CheckSquare, nativeClick: true, onClick: () => { try { onAddTask?.() } catch {} } }] : []),
    ...(onAddHeadline ? [{ label: 'Add Headline', icon: TextHOne, nativeClick: true, onClick: () => { try { onAddHeadline?.() } catch {} } }] : []),
    { label: 'Upload', icon: Upload, nativeClick: true, onClick: onUploadDocument },
    ...(onReorganize && nodeCount > 1 ? [{ label: 'Reorganize', icon: ClockCounterClockwise, nativeClick: true, onClick: onReorganize }] : []),
  ]

  return (
    <div className="fixed bottom-2 left-2 md:bottom-4 md:left-1/2 md:transform md:-translate-x-1/2 z-20 nodal-no-select">
      <Menu
        trigger={
          <IconButton
            aria-label="Open Actions"
            size="lg"
            variant="primaryOutline"
            className="bg-white/70 border border-gray-200/50 dark:border-none dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-900 text-white"
          >
            <img src="/nodal.svg" alt="Nodal" className="w-6 h-6" />
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