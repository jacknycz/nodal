import React, { useState, useRef, useEffect } from 'react'

interface TopicModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (topic: string) => void
  defaultTopic?: string
}

export default function TopicModal({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultTopic = ''
}: TopicModalProps) {
  const [topic, setTopic] = useState(defaultTopic)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTopic(defaultTopic)
      // Focus after modal opens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          if (defaultTopic) {
            inputRef.current.select()
          }
        }
      }, 100)
    }
  }, [isOpen, defaultTopic])

  const handleSave = () => {
    if (topic.trim()) {
      onSave(topic.trim())
      onClose()
    }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            What is the base topic for your board in a few words?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don't worry - literally your next step is to ramble about all the things...
          </p>
        </div>
        
        {/* Input */}
        <div className="mb-8">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Marketing Plan, Research Project, App Idea..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!topic.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Update Topic
          </button>
        </div>
      </div>
    </div>
  )
} 