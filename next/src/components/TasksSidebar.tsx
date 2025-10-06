'use client'
import React from 'react'

type TaskItem = { boardId: string; boardName: string; nodeId: string; title: string }

interface TasksSidebarProps {
  incompleteTasks: TaskItem[]
  tasksLoading: boolean
  allBoards: any[]
  onOpenBoard: (board: any, brief?: any) => void
}

export default function TasksSidebar({ incompleteTasks, tasksLoading, allBoards, onOpenBoard }: TasksSidebarProps) {
  return (
    <div className="flex flex-col gap-4 mt-8">
      <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">task nodes</h2>
      {tasksLoading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading tasks…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {incompleteTasks.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No incomplete tasks. Nice work!</div>
          )}
          {incompleteTasks.slice(0, 10).map((t) => (
            <button
              key={`${t.boardId}-${t.nodeId}`}
              onClick={() => {
                const b = allBoards.find((bb) => bb.id === t.boardId) as any
                if (b) onOpenBoard(b, undefined)
              }}
              className="group text-left flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span aria-hidden className="inline-flex w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 group-hover:border-primary-400" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[220px]">{t.title}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.boardName}</span>
                </div>
              </div>
              <span className="text-[11px] text-primary-600 dark:text-primary-400">Open</span>
            </button>
          ))}
          {incompleteTasks.length > 10 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Showing 10 of {incompleteTasks.length} tasks</div>
          )}
        </div>
      )}
    </div>
  )
}


