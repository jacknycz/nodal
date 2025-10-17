'use client'

import Search from './ui/Search'
import React from 'react'
import Checkbox from './ui/Checkbox'
import Loader from './ui/Loader'
import BoardCard from './BoardCard'
import Button from './ui/Button'
import { PlusIcon, ArrowFatUp } from '@phosphor-icons/react'

interface BoardsTabProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  showSharedOnly: boolean
  setShowSharedOnly: (v: boolean) => void
  error: string | null
  loading: boolean
  sortedBoards: Array<any>
  pinnedBoardIds: string[]
  onOpenBoard: (board: any) => void
  onRename: (boardId: string, newName: string) => void
  onDelete: (boardId: string) => void
  togglePin: (boardId: string) => void
}

export default function BoardsTab({
  searchQuery,
  setSearchQuery,
  showSharedOnly,
  setShowSharedOnly,
  error,
  loading,
  sortedBoards,
  pinnedBoardIds,
  onOpenBoard,
  onRename,
  onDelete,
  togglePin,
}: BoardsTabProps) {
  // Render all boards at once to avoid post-load updates that can cause flashes

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10">
      <div className="flex flex-col justify-between items-center gap-4 md:gap-6 xl:gap-8 mb-8">
        <div className="flex justify-center w-full max-w-xl gap-4">
          <Button
            // icon={<PlusIcon weight="duotone" className="w-4 h-4" />}
            variant="primary"
            onClick={() => onOpenBoard(null)}
            className="block md:hidden flex-none"
            size="lg"
          >
            new board
          </Button>

          <Search
            placeholder="search boards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            label="search boards..."
            className="w-full"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 p-4 animate-pulse shadow-xl shadow-gray-200/20 dark:shadow-none flex flex-col min-h-[190px]"
            >
              {/* Title */}
              <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              {/* Date */}
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              {/* Stats row */}
              <div className="flex items-center gap-6 mb-2">
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              {/* Spacer */}
              <div className="flex-1" />
              {/* Footer actions: left menu circle, right two buttons */}
              <div className="pt-3 flex items-center justify-between">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex items-center gap-2">
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
              </div>
            </div>
          ))
        ) : (
          sortedBoards.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
              No boards found - go to the templates tab <ArrowFatUp size={14} weight="duotone" className="inline-block text-primary-500" /> to start with the Welcome Board!
            </div>
          ) : (
            (sortedBoards).map((board: any) => (
              <BoardCard
                key={board.id}
                id={board.id}
                name={board.name}
                lastModified={board.lastModified}
                nodeCount={board.nodeCount}
                edgeCount={board.edgeCount}
                topic={(board as any)?.data?.topic || null}
                onLoad={() => onOpenBoard(board)}
                onRename={newName => onRename(board.id, newName)}
                onDelete={() => onDelete(board.id)}
                isPinned={pinnedBoardIds.includes(board.id)}
                onTogglePin={() => togglePin(board.id)}
              />
            ))
          )
        )}
      </div>
    </div>
  )
}


