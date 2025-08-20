'use client'

import React from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { templateStorage, type TemplateRecord } from '../features/storage/templateStorage'

interface TemplatePickerModalProps {
  open: boolean
  onClose: () => void
  onUseTemplate: (template: TemplateRecord) => Promise<void> | void
}

export default function TemplatePickerModal({ open, onClose, onUseTemplate }: TemplatePickerModalProps) {
  const [templates, setTemplates] = React.useState<TemplateRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const load = async () => {
      if (!open) return
      setLoading(true)
      setError(null)
      try {
        const list = await templateStorage.getAllTemplates()
        setTemplates(list)
      } catch (e: any) {
        setError('Failed to load templates')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Use a template" description="Choose a template to start a new board.">
      <div className="space-y-3">
        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
        {loading ? (
          <div className="text-sm text-gray-500">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-gray-500">No templates yet.</div>
        ) : (
          <div className="max-h-64 overflow-auto divide-y divide-gray-200 dark:divide-gray-700 rounded">
            {templates.map(t => (
              <div key={t.id} className="py-2 px-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.description || `${t.nodeCount} nodes • ${t.edgeCount} edges`}</div>
                </div>
                <Button onClick={() => onUseTemplate(t)}>Use</Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}


