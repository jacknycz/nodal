'use client'

import React from 'react'

interface TopicDisplayProps {
  topic?: string
  onEdit: () => void
}

export default function TopicDisplay({ topic, onEdit }: TopicDisplayProps) {
  if (!topic) return null

  return (
    <div className="fixed top-4 left-4 z-40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {topic}
        </h3>
      </div>
    </div>
  )
} 