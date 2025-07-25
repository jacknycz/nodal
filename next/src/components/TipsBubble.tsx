'use client'

import React from 'react'

interface TipsBubbleProps {
  tips: string[]
}

export default function TipsBubble({ tips }: TipsBubbleProps) {
  return (
    <div className="fixed top-4 left-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 max-w-xs">
      <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Quick Tips</div>
      <ul className="space-y-1">
        {tips.map((tip, index) => (
          <li key={index} className="flex items-start">
            <span className="text-blue-500 mr-1">•</span>
            {tip}
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Keyboard Shortcuts</div>
        <div className="space-y-1 text-xs">
          <div><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl+N</kbd> Add node</div>
          <div><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl+G</kbd> Generate AI nodes</div>
          <div><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl+Shift+C</kbd> Clear board</div>
          <div><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Esc</kbd> Close modals</div>
        </div>
      </div>
    </div>
  )
} 