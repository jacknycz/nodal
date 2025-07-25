'use client'

import React from 'react'

interface TopicModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (topic: string) => void
  defaultTopic: string
}

export default function TopicModal({ isOpen, onClose, onSave, defaultTopic }: TopicModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Set Topic</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Topic modal coming soon...
        </p>
        <button
          onClick={onClose}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  )
} 