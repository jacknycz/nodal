'use client'

import Loader from './ui/Loader'
import Button from './ui/Button'
import BoardCard from './BoardCard'
import { templateStorage } from '../features/storage/templateStorage'
import { isAdmin } from '../features/auth/roles'
import React from 'react'

interface TemplatesTabProps {
  templates: Array<any>
  templatesLoading: boolean
  templatesError: string | null
  user: any
  setTemplates: (updater: (prev: any[]) => any[]) => void
  onOpenBoard: (board: any) => void
}

export default function TemplatesTab({
  templates,
  templatesLoading,
  templatesError,
  user,
  setTemplates,
  onOpenBoard,
}: TemplatesTabProps) {
  const [visibleCount, setVisibleCount] = React.useState(() => Math.min(templates.length, 24))

  React.useEffect(() => {
    setVisibleCount(Math.min(templates.length, 24))
    let cancelled = false
    const pump = () => {
      if (cancelled) return
      if (visibleCount >= templates.length) return
      setVisibleCount((c) => Math.min(templates.length, c + 24))
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(pump, { timeout: 1200 })
      } else {
        setTimeout(pump, 0)
      }
    }
    if (templates.length > 30) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(pump, { timeout: 1200 })
      } else {
        setTimeout(pump, 0)
      }
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10 min-h-screen">
      {templatesError && (
        <div className="mb-4 text-red-600 dark:text-red-400">{templatesError}</div>
      )}
      {templatesLoading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Loader />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
              No templates yet.
            </div>
          ) : (
            (templates.slice(0, visibleCount)).map((t: any) => {
              const admin = isAdmin(user)
              const footer = (
                <>
                  {admin && (
                    <Button
                      variant="secondaryGhost"
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const { boardStorage } = await import('../features/storage/storage')
                          const id = await boardStorage.saveBoard(t.name, t.data)
                          try { localStorage.setItem(`templateMapping:${id}`, t.id) } catch { }
                          const newBoard = await boardStorage.loadBoard(id)
                          if (newBoard) {
                            onOpenBoard(newBoard)
                          } else if (typeof window !== 'undefined') {
                            window.location.href = `/board/${id}`
                          }
                        } catch (err) {
                          alert('Failed to open template for editing')
                        }
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="small"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        const newName = `${t.name} (copy)`
                        const { boardStorage } = await import('../features/storage/storage')
                        const id = await boardStorage.saveBoard(newName, t.data)
                        const newBoard = await boardStorage.loadBoard(id)
                        if (newBoard) {
                          onOpenBoard(newBoard)
                        } else if (typeof window !== 'undefined') {
                          window.location.href = `/board/${id}`
                        }
                      } catch (e) {
                        alert('Failed to use template')
                      }
                    }}
                  >
                    Use
                  </Button>
                </>
              )
              return (
                <BoardCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  nodeCount={t.nodeCount}
                  edgeCount={t.edgeCount}
                  onLoad={async () => {
                    try {
                      const newName = `${t.name} (copy)`
                      const { boardStorage } = await import('../features/storage/storage')
                      const id = await boardStorage.saveBoard(newName, t.data)
                      const newBoard = await boardStorage.loadBoard(id)
                      if (newBoard) {
                        onOpenBoard(newBoard)
                      } else if (typeof window !== 'undefined') {
                        window.location.href = `/board/${id}`
                      }
                    } catch (e) {
                      alert('Failed to use template')
                    }
                  }}
                  onRename={admin ? async (newName) => {
                    try {
                      const updated = await templateStorage.updateTemplate(t.id, { name: newName })
                      setTemplates(prev => prev.map((p: any) => p.id === t.id ? updated : p))
                    } catch {
                      alert('Failed to rename template')
                    }
                  } : undefined}
                  enableSharing={false}
                  footerActions={footer}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}


