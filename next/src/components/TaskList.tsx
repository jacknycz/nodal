"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useBoardStore } from '../features/board/boardSlice'
import Checkbox from './ui/Checkbox'
import { X, ListChecks, Pen } from '@phosphor-icons/react'
import { useReactFlow } from '@xyflow/react'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import { useSupabaseUser } from '../features/auth/authUtils'
import IconButton from './ui/IconButton'

interface TaskListProps {
  open?: boolean
  onClose?: () => void
  dock?: boolean
  leftOffsetPx?: number
  topOffsetPx?: number
  anchored?: boolean
}

export default function TaskList({ open, onClose, dock = false, leftOffsetPx = 56, topOffsetPx = 72, anchored = false }: TaskListProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = typeof open === 'boolean' ? open : internalOpen
  const setIsOpen = (next: boolean) => {
    if (typeof open === 'boolean') {
      if (!next && onClose) onClose()
    } else {
      setInternalOpen(next)
    }
  }
  const nodes = useBoardStore((s) => s.nodes || [])
  const boardId = useBoardStore((s) => s.currentBoardId)
  const { setNodes, getNodes, setCenter, getZoom } = useReactFlow()
  const supabase = getSupabaseClient()
  const user = useSupabaseUser()

  const [showMineOnly, setShowMineOnly] = useState(false)
  const [hasMultipleMembers, setHasMultipleMembers] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!boardId) { setHasMultipleMembers(false); return }
        const res = await fetch(`/api/board/members?boardId=${encodeURIComponent(boardId)}`)
        if (!res.ok) { setHasMultipleMembers(false); return }
        const json = await res.json()
        const members = Array.isArray(json?.members) ? json.members : []
        if (!cancelled) setHasMultipleMembers(members.length > 1)
      } catch {
        if (!cancelled) setHasMultipleMembers(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [boardId])
  const tasks = useMemo(() => {
    const list = (nodes as any[])
      .filter((n) => n?.type === 'task')
      .map((n) => ({ id: n.id, title: n?.data?.title || 'Untitled', completed: !!n?.data?.completed, assigneeId: (n?.data as any)?.assigneeId || null }))
    if (showMineOnly && user?.id) return list.filter(t => t.assigneeId === user.id)
    return list
  }, [nodes, showMineOnly, user?.id])

  const toggleTask = async (taskId: string, next: boolean) => {
    setNodes((nds: any[]) => nds.map((n) => n.id === taskId ? { ...n, data: { ...(n.data || {}), completed: next } } : n))
    if (boardId && user?.id) {
      try {
        await supabase.from('board_updates').insert({
          board_id: boardId,
          node_id: taskId,
          update_type: 'content',
          data: { completed: next },
          user_id: user.id,
        })
      } catch {}
    }
  }

  const openEditTask = (id: string) => {
    try {
      // Ask board to open edit modal and center on node
      window.dispatchEvent(new CustomEvent('nodal:edit-node', { detail: { id } }))
    } catch {}
  }

  return (
    <>
      {/* Toggle Button hidden in dock/anchored mode */}
      {!dock && !anchored && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed left-4 z-40 bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 transition-all duration-200 ease-out bottom-4 sm:bottom-auto sm:top-16 ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
          title="Open Tasks"
        >
          <ListChecks className="w-5 h-5" />
        </button>
      )}

      {/* Panel */}
      <div
        className={`${anchored ? '' : 'fixed'} rounded-4xl z-60 w-64 max-h-[calc(100dvh-80px)] bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
        style={anchored ? undefined : { top: topOffsetPx, left: dock ? leftOffsetPx : 16 }}
        data-left-dock-panel
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
          <div className="flex items-center space-x-2">
            <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Tasks ({tasks.length})</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tasks.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No tasks yet. Add a task from the board context menu.</div>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white/70 dark:bg-gray-800/60">
              <Checkbox
                checked={t.completed}
                onChange={(checked) => toggleTask(t.id, !!checked)}
                shape="circle"
              />
              <div className={`text-sm truncate flex-1 ${t.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{t.title}</div>
              <IconButton aria-label="Edit task" variant="secondaryGhost" size="sm" onClick={() => openEditTask(t.id)} title="Edit task">
                <Pen className="w-4 h-4" />
              </IconButton>
            </div>
          ))}
        </div>

         {/* Filters */}
         {hasMultipleMembers && (
          <div className="px-4 mb-2">
            <Checkbox
              checked={showMineOnly}
              onChange={(v) => setShowMineOnly(!!v)}
              label="Only my tasks"
            />
          </div>
        )}
      </div>
    </>
  )
}