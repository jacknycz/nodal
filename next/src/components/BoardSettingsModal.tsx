'use client'

import React, { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Select from './ui/Select'
import Button from './ui/Button'
import { boardStorage } from '../features/storage/storage'
import { useBoardStore } from '../features/board/boardSlice'
import BoardMembersRoleEditor from './BoardMembersRoleEditor'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import type { OpenAIModel } from '../features/ai/aiTypes'
import { MODELS } from '../features/ai/models'
import Toggle from './ui/Toggle'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  open: boolean
  onClose: () => void
  boardId: string
  initialName?: string
  isOwnerView?: boolean
}

export default function BoardSettingsModal({ open, onClose, boardId, initialName, isOwnerView = false }: Props) {
  const [tab, setTab] = useState<'board' | 'aisettings' | 'members'>('board')
  const [pendingBoardName, setPendingBoardName] = useState(initialName || '')
  const edgeType = useBoardStore((s: any) => s.edgeType || 'floating')
  const setEdgeType = useBoardStore((s: any) => s.setEdgeType)
  const topic = useBoardStore((s: any) => s.topic || '')
  const setTopic = useBoardStore((s: any) => s.setTopic)
  const { model, setModel, temperature, setTemperature } = useAISettingsStore()
  const { isDark, setTheme } = useTheme()

  useEffect(() => { if (open) setPendingBoardName(initialName || '') }, [open, initialName])
  useEffect(() => { if (open) setTab('board') }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Board Settings"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            try {
              const newName = (pendingBoardName || '').trim()
              if (isOwnerView && boardId && newName && newName !== (initialName || '')) {
                try {
                  await boardStorage.renameBoard(boardId, newName)
                  try { window.dispatchEvent(new CustomEvent('nodal:board-name-updated', { detail: { boardId, name: newName } })) } catch {}
                } catch {}
              }
              onClose()
            } catch {}
          }}>Save</Button>
        </>
      }
    >
      <div className="space-y-3 py-2">
        {/* Tabs header */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            type="button"
            className={`w-full px-3 py-2 rounded-md text-sm font-medium ${tab === 'board' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
            onClick={() => { try { console.log('[BoardSettingsModal] tab -> board') } catch {} ; setTab('board') }}
          >
            Board
          </button>
          <button
            type="button"
            className={`w-full px-3 py-2 rounded-md text-sm font-medium ${tab === 'aisettings' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
            onClick={() => { try { console.log('[BoardSettingsModal] tab -> aisettings') } catch {} ; setTab('aisettings') }}
          >
            AI Settings
          </button>
          <button
            type="button"
            className={`w-full px-3 py-2 rounded-md text-sm font-medium ${tab === 'members' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'}`}
            onClick={() => { try { console.log('[BoardSettingsModal] tab -> members') } catch {} ; setTab('members') }}
          >
            Members
          </button>
        </div>

        {tab === 'board' && (
          <div className="space-y-3">
            <TextInput
              label="Board title"
              value={pendingBoardName}
              onChange={(e) => setPendingBoardName((e.target as HTMLInputElement).value)}
              placeholder="Enter board title..."
              fullWidth
              disabled={!isOwnerView}
              autoFocus
            />
            <TextInput
              label="Board topic"
              value={topic}
              onChange={(e) => setTopic((e.target as HTMLInputElement).value)}
              placeholder="Enter topic..."
              fullWidth
            />
            <div className="pt-1">
              <Toggle
                checked={isDark}
                onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                label="Dark mode"
                description="Toggle between light and dark themes."
              />
            </div>
            <Select
              label="Edge type"
              value={edgeType as any}
              onChange={(val) => setEdgeType?.((val as string) as any)}
              options={[
                { value: 'floating', label: 'Floating (Nodal default)' },
                { value: 'straight', label: 'Straight' },
                { value: 'step', label: 'Step' },
                { value: 'smoothstep', label: 'Smooth Step' },
              ]}
              fullWidth
              description="Choose how edges render on this board."
            />
          </div>
        )}

        {tab === 'aisettings' && (
          <div className="space-y-3">
            <Select
              label="AI model"
              value={model as any}
              onChange={(v) => setModel(v as OpenAIModel)}
              options={MODELS}
              fullWidth
            />
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                Creativity (Temperature: {temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat((e.target as HTMLInputElement).value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="pt-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Board Members</div>
            <BoardMembersRoleEditor boardId={boardId} isOwnerView={isOwnerView} />
          </div>
        )}
      </div>
    </Modal>
  )
}


