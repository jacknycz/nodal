import React, { useState, useEffect, useRef } from 'react'
import type { SavedBoard } from '../features/storage/storage'

interface BoardRoomModalProps {
  isOpen: boolean
  onClose: () => void
  onLoadBoard: (board: SavedBoard) => void
  onRenameBoard: (boardId: string, newName: string) => void
  onDeleteBoard: (boardId: string) => void
  onNewBoard: () => void
  currentBoardId?: string
}

interface BoardCardProps {
  board: SavedBoard
  isActive: boolean
  onLoad: () => void
  onRename: (newName: string) => void
  onDelete: () => void
}

function BoardCard({ board, isActive, onLoad, onRename, onDelete }: BoardCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(board.name)
  const [showActions, setShowActions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

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
      className={`relative group p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer ${
        isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onLoad}
    >
      {/* Board Name */}
      <div className="mb-2">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            className="w-full text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
            maxLength={50}
            onClick={(e) => e.stopPropagation()}
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{board.nodeCount} nodes</span>
        </div>
        <div className="flex items-center space-x-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>{board.edgeCount} connections</span>
        </div>
      </div>

      {/* Last Modified */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {formatDate(board.lastModified)}
      </p>

      {/* Action Buttons */}
      {showActions && !isRenaming && (
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
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
            onClick={(e) => {
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
      )}

      {/* Active Badge */}
      {isActive && (
        <div className="absolute top-2 left-2">
          <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
            Active
          </div>
        </div>
      )}
    </div>
  )
}

export default function BoardRoomModal({
  isOpen,
  onClose,
  onLoadBoard,
  onRenameBoard,
  onDeleteBoard,
  onNewBoard,
  currentBoardId,
}: BoardRoomModalProps) {
  const [boards, setBoards] = useState<SavedBoard[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  const loadBoards = async () => {
    setLoading(true)
    setError('')
    try {
      // We'll import the boardStorage when we integrate this
      // For now, we'll use a placeholder
      const { boardStorage } = await import('../features/storage/storage')
      const allBoards = await boardStorage.getAllBoards()
      setBoards(allBoards)
    } catch (err) {
      console.error('Failed to load boards:', err)
      setError('Failed to load boards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadBoards()
      setSearchQuery('')
    }
  }, [isOpen])

  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const recentBoards = filteredBoards.slice(0, 3)
  const allBoards = filteredBoards

  const handleRename = async (boardId: string, newName: string) => {
    try {
      await onRenameBoard(boardId, newName)
      await loadBoards() // Refresh the list
    } catch (err) {
      console.error('Failed to rename board:', err)
      setError('Failed to rename board')
    }
  }

  const handleDelete = async (boardId: string) => {
    try {
      await onDeleteBoard(boardId)
      await loadBoards() // Refresh the list
    } catch (err) {
      console.error('Failed to delete board:', err)
      setError('Failed to delete board')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🏢 The Board Room</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your saved boards
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                onNewBoard()
                onClose()
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Board</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading boards...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadBoards}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No boards yet</h3>
              <p className="text-gray-500 dark:text-gray-400">Create your first board to get started!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recent Boards */}
              {recentBoards.length > 0 && searchQuery === '' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recent Boards
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {recentBoards.map((board) => (
                      <BoardCard
                        key={board.id}
                        board={board}
                        isActive={board.id === currentBoardId}
                        onLoad={() => onLoadBoard(board)}
                        onRename={(newName) => handleRename(board.id, newName)}
                        onDelete={() => handleDelete(board.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Boards */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {searchQuery ? `Search Results (${filteredBoards.length})` : `All Boards (${boards.length})`}
                </h3>
                
                {filteredBoards.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No boards match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allBoards.map((board) => (
                      <BoardCard
                        key={board.id}
                        board={board}
                        isActive={board.id === currentBoardId}
                        onLoad={() => onLoadBoard(board)}
                        onRename={(newName) => handleRename(board.id, newName)}
                        onDelete={() => handleDelete(board.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 