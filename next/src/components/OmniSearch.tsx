'use client'

import React, { useMemo, useState } from 'react'
import { useBoardStore } from '../features/board/boardSlice'
import FloatingSearch from './ui/Search'
import { useReactFlow } from '@xyflow/react'
import { CrosshairSimple } from '@phosphor-icons/react'

export default function OmniSearch() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [isHoveringResults, setIsHoveringResults] = useState(false)
  const nodes = useBoardStore((s) => s.nodes || [])
  const rf = useReactFlow()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as { id: string; title: string }[]
    return (nodes as any[])
      .map((n) => {
        const d = (n?.data || {}) as any
        const title = d.title || d.fileName || 'Untitled'
        const content =
          (typeof d.content === 'string' ? d.content : '') +
          ' ' +
          (typeof d.extractedText === 'string' ? d.extractedText : '')
        const haystack = `${title} ${content}`.toLowerCase()
        return { id: n.id as string, title, haystack }
      })
      .filter((r) => r.haystack.includes(q))
      .map(({ id, title }) => ({ id, title }))
      .slice(0, 20)
  }, [nodes, query])

  const panToNode = (id: string) => {
    try {
      const n = rf.getNodes().find((x) => x.id === id)
      if (!n) return
      const width = (n as any).width || (n as any).measured?.width || 240
      const height = (n as any).height || (n as any).measured?.height || 140
      const centerX = n.position.x + width / 2
      const centerY = n.position.y + height / 2
      rf.setCenter(centerX, centerY, { zoom: Math.max(0.8, Math.min(1.2, rf.getZoom())), duration: 600 })
      // Pulse highlight
      const nodeOuter = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null
      const nodeInner = nodeOuter?.querySelector(':scope > div') as HTMLElement | null
      const targetEl = nodeInner || nodeOuter
      if (targetEl) {
        targetEl.classList.add('node-pulse-highlight')
        window.setTimeout(() => targetEl.classList.remove('node-pulse-highlight'), 1500)
      }
    } catch {}
  }

  const showResults = !!query && (isFocused || isHoveringResults)

  return (
    <div className="fixed top-13 md:top-2 right-2 md:left-1/2 md:-translate-x-1/2 z-[600] w-64 nodal-no-select">
      <FloatingSearch
        label="Search nodes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className=""
        id="omni-search"
      />
      {/* Results dropdown */}
      <div
        onMouseEnter={() => setIsHoveringResults(true)}
        onMouseLeave={() => setIsHoveringResults(false)}
        className={`mt-2 rounded-2xl shadow-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs border border-gray-200/60 dark:border-gray-700/60 transition-all duration-150 overflow-hidden ${
          showResults ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {showResults && results.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No matches</div>
        )}
        {showResults && results.length > 0 && (
          <ul className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <li
                key={r.id}
                onClick={() => panToNode(r.id)}
                className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200 border-b border-gray-200/60 dark:border-gray-700/60 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-center gap-2 justify-between">
                  <div className="min-w-0 truncate">{r.title}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); panToNode(r.id) }}
                    className="flex-none text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                    title="Center on node"
                  >
                    <CrosshairSimple className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


