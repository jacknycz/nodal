'use client'

import React, { useState } from 'react'

interface FloatingActionButtonProps {
  onAddNode: () => void
  onOpenAIGenerator: () => void
  onClearBoard: () => void
  onReorganize: () => void
  hasNodes: boolean
}

export default function FloatingActionButton({
  onAddNode,
  onOpenAIGenerator,
  onClearBoard,
  onReorganize,
  hasNodes,
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col items-end space-y-2">
        {isExpanded && (
          <>
            <button
              onClick={onAddNode}
              className="bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-all transform scale-90"
              title="Add Node"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={onOpenAIGenerator}
              className="bg-green-600 text-white rounded-full p-3 shadow-lg hover:bg-green-700 transition-all transform scale-90"
              title="Generate AI Nodes"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
            {hasNodes && (
              <>
                <button
                  onClick={onReorganize}
                  className="bg-purple-600 text-white rounded-full p-3 shadow-lg hover:bg-purple-700 transition-all transform scale-90"
                  title="Reorganize Nodes"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={onClearBoard}
                  className="bg-red-600 text-white rounded-full p-3 shadow-lg hover:bg-red-700 transition-all transform scale-90"
                  title="Clear Board"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-all"
          title={isExpanded ? "Close Menu" : "Open Menu"}
        >
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-45' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
} 