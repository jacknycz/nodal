'use client'

import React, { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Select from './ui/Select'
import Button from './ui/Button'
import { boardStorage } from '../features/storage/storage'
import { useBoardStore } from '../features/board/boardSlice'
import BoardMembersRoleEditor from './BoardMembersRoleEditor'

interface Props {
  open: boolean
  onClose: () => void
  boardId: string
  initialName?: string
  isOwnerView?: boolean
}

export default function BoardSettingsModal({ open, onClose, boardId, initialName, isOwnerView = false }: Props) {
  const [pendingBoardName, setPendingBoardName] = useState(initialName || '')
  const edgeType = useBoardStore((s: any) => s.edgeType || 'floating')
  const setEdgeType = useBoardStore((s: any) => s.setEdgeType)
  const topic = useBoardStore((s: any) => s.topic || '')
  const setTopic = useBoardStore((s: any) => s.setTopic)

  useEffect(() => { if (open) setPendingBoardName(initialName || '') }, [open, initialName])

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
              if (boardId && newName && newName !== (initialName || '')) {
                try { await boardStorage.renameBoard(boardId, newName) } catch {}
              }
              onClose()
            } catch {}
          }}>Save</Button>
        </>
      }
    >
      <div className="space-y-3 py-2">
        <TextInput
          label="Board title"
          value={pendingBoardName}
          onChange={(e) => setPendingBoardName((e.target as HTMLInputElement).value)}
          placeholder="Enter board title..."
          fullWidth
          autoFocus
        />
        <TextInput
          label="Board topic"
          value={topic}
          onChange={(e) => setTopic((e.target as HTMLInputElement).value)}
          placeholder="Enter topic..."
          fullWidth
        />
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

        {/* Board members and roles */}
        <div className="pt-4">
          <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Board Members</div>
          <BoardMembersRoleEditor boardId={boardId} isOwnerView={isOwnerView} />
        </div>
      </div>
    </Modal>
  )
}


