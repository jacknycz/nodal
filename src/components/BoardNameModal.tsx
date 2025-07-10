import React, { useState, useRef, useEffect } from 'react'

interface BoardNameModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => void
  defaultName?: string
  existingNames?: string[]
}

export default function BoardNameModal({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultName = '',
  existingNames = []
}: BoardNameModalProps) {
  const [boardName, setBoardName] = useState(defaultName)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setBoardName(defaultName)
      setError('')
      // Focus and select text after modal opens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 100)
    }
  }, [isOpen, defaultName])

  const validateName = (name: string): string | null => {
    const trimmed = name.trim()
    
    if (!trimmed) {
      return 'Board name is required'
    }
    
    if (trimmed.length < 2) {
      return 'Board name must be at least 2 characters'
    }
    
    if (trimmed.length > 50) {
      return 'Board name must be less than 50 characters'
    }
    
    if (existingNames.includes(trimmed)) {
      return 'A board with this name already exists'
    }
    
    return null
  }

  const handleSave = () => {
    const validationError = validateName(boardName)
    
    if (validationError) {
      setError(validationError)
      return
    }
    
    onSave(boardName.trim())
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBoardName(e.target.value)
    if (error) {
      setError('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Save Board</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Give your board a memorable name</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="boardName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Board Name
            </label>
            <input
              ref={inputRef}
              id="boardName"
              type="text"
              value={boardName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Project Ideas, Meeting Notes, Research..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={50}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {boardName.length}/50 characters
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!boardName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Save Board
          </button>
        </div>
      </div>
    </div>
  )
} 