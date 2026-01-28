'use client'
import React from 'react'
import Modal from './ui/Modal'
import IconButton from './ui/IconButton';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';

type TaskItem = { boardId: string; boardName: string; nodeId: string; title: string }

interface TasksSidebarProps {
  incompleteTasks: TaskItem[]
  tasksLoading: boolean
  allBoards: any[]
  onOpenBoard: (board: any, brief?: any) => void
}

export default function TasksSidebar({ incompleteTasks, tasksLoading, allBoards, onOpenBoard }: TasksSidebarProps) {
  const [showAll, setShowAll] = React.useState(false)
  const previewCount = 3

  const TaskRow = ({ t }: { t: TaskItem }) => (
    <div
      className="group text-left flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-900 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span aria-hidden className="inline-flex w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 group-hover:border-primary-400" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[220px]">{t.title}</span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.boardName}</span>
        </div>
      </div>
      <IconButton
        variant="secondary"
        size="sm"
        onClick={() => {
          const b = allBoards.find((bb) => bb.id === t.boardId) as any
          if (b) onOpenBoard(b, undefined)
        }}
        aria-label="Open task"
      >
        <ArrowRight size={16} />
      </IconButton>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">tasks</h2>
      {tasksLoading && incompleteTasks.length === 0 && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`task-skel-${i}`}
              className="rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-700/80 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden className="inline-flex w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70" />
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {(incompleteTasks.length > 0 || !tasksLoading) && (
        <div className="flex flex-col gap-2">
          {incompleteTasks.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No incomplete tasks. </div>
          )}

          {incompleteTasks.slice(0, previewCount).map((t) => (
            <TaskRow key={`${t.boardId}-${t.nodeId}`} t={t} />
          ))}

          {incompleteTasks.length > previewCount && (
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>
                {previewCount} of {incompleteTasks.length}
              </span>
              <button className="cursor-pointer text-primary-600 dark:text-primary-400 hover:underline" onClick={() => setShowAll(true)}>
                View All
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showAll}
        onClose={() => setShowAll(false)}
        title="All Tasks"
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto scrollbar-themed py-1">
          {incompleteTasks.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No incomplete tasks.</div>
          ) : (
            incompleteTasks.map((t) => (
              <TaskRow key={`all-${t.boardId}-${t.nodeId}`} t={t} />
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}


