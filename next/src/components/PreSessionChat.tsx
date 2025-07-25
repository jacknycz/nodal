'use client'

import React from 'react'

interface PreSessionChatProps {
  isOpen: boolean
  onClose: () => void
}

export default function PreSessionChat({ isOpen, onClose }: PreSessionChatProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Pre-Session Chat</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Pre-session chat coming soon...
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