'use client'

import React, { useState } from 'react'

interface TopicModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (topic: string) => void
}

export default function TopicModal({
  isOpen,
  onClose,
  onSave,
}: TopicModalProps) {
  const [topic, setTopic] = useState('')

  if (!isOpen) return null

  const handleSave = () => {
    if (topic.trim()) {
      onSave(topic.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        <h2 className="text-xl font-bold mb-4">Set Board Topic</h2>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter board topic..."
          className="w-full p-3 border border-gray-300 rounded-lg mb-4"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSave()
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!topic.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
} 