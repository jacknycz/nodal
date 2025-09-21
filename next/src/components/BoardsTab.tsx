'use client'

import Search from './ui/Search'
import React from 'react'
import Checkbox from './ui/Checkbox'
import Loader from './ui/Loader'
import BoardCard from './BoardCard'
import Button from './ui/Button'
import { PlusIcon } from '@phosphor-icons/react'

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
      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Loader />
        </div>
      ) : (
        <>
          <div className="flex flex-col justify-between items-center gap-4 md:gap-6 xl:gap-8 mb-8">
            <div className="flex justify-center w-full max-w-xl gap-4">
              <Button
                // icon={<PlusIcon weight="duotone" className="w-4 h-4" />}
                variant="primary"
                onClick={() => onOpenBoard(null)}
                className="block md:hidden flex-none"
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

            {/* <div className="flex items-center gap-4 flex-none">
              <Checkbox
                label="show shared only"
                checked={showSharedOnly}
                onChange={(v) => setShowSharedOnly(v)}
                labelTextClassName='text-sm text-gray-500 dark:text-gray-400'
              />
            </div> */}
          </div>

          {error && (
            <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {sortedBoards.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
                No boards found. Create a new board to get started!
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
                  onLoad={() => onOpenBoard(board)}
                  onRename={newName => onRename(board.id, newName)}
                  onDelete={() => onDelete(board.id)}
                  isPinned={pinnedBoardIds.includes(board.id)}
                  onTogglePin={() => togglePin(board.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}


