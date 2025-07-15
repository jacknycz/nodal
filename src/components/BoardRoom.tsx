import React, { useState, useEffect } from 'react'
import type { SavedBoard } from '../features/storage/storage'

interface BoardRoomProps {
  onOpenBoard: (board: SavedBoard) => void
  onNewBoard: () => void
}

function BoardCard({ board, onLoad, onRename, onDelete }: {
  board: SavedBoard
  onLoad: () => void
  onRename: (newName: string) => void
  onDelete: () => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(board.name)

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== board.name) {
      onRename(newName.trim())
    }
    setIsRenaming(false)
    setNewName(board.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsRenaming(false)
      setNewName(board.name)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffHours < 1) {
      return 'Just now'
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div
      className="relative group p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
      onClick={onLoad}
    >
      {/* Board Name */}
      <div className="mb-2">
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            className="w-full text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
            maxLength={50}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {board.name}
          </h3>
        )}
      </div>
      {/* Board Stats */}
      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <div className="flex items-center space-x-1">
          <span>{board.nodeCount} nodes</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>{board.edgeCount} connections</span>
        </div>
      </div>
      {/* Last Modified */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {formatDate(board.lastModified)}
      </p>
      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => {
            e.stopPropagation()
            setIsRenaming(true)
          }}
          className="p-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Rename board"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Are you sure you want to delete "${board.name}"?`)) {
              onDelete()
            }
          }}
          className="p-1 rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors"
          title="Delete board"
        >
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const BoardRoom: React.FC<BoardRoomProps> = ({ onOpenBoard, onNewBoard }) => {
  const [boards, setBoards] = useState<SavedBoard[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  const loadBoards = async () => {
    setLoading(true)
    setError('')
    try {
      const { boardStorage } = await import('../features/storage/storage')
      const allBoards = await boardStorage.getAllBoards()
      setBoards(allBoards)
    } catch (err) {
      setError('Failed to load boards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoards()
  }, [])

  const handleRename = async (boardId: string, newName: string) => {
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.renameBoard(boardId, newName)
      await loadBoards()
    } catch (err) {
      setError('Failed to rename board')
    }
  }

  const handleDelete = async (boardId: string) => {
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.deleteBoard(boardId)
      await loadBoards()
    } catch (err) {
      setError('Failed to delete board')
    }
  }

  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Boards</h2>
          <button
            onClick={onNewBoard}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Board</span>
          </button>
        </div>
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search boards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && (
          <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
        )}
        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading boards...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBoards.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
                No boards found. Create a new board to get started!
              </div>
            ) : (
              filteredBoards.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onLoad={() => onOpenBoard(board)}
                  onRename={newName => handleRename(board.id, newName)}
                  onDelete={() => handleDelete(board.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BoardRoom 