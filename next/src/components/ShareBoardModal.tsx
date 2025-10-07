'use client'

import React, { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import Select from './ui/Select'
import Tag from './ui/Tag'
import { Copy, Plus, XSquare } from '@phosphor-icons/react/dist/ssr'
import { useSupabaseUser } from '../features/auth/authUtils'

type ShareInvite = { email: string; role: 'owner' | 'editor' | 'viewer' }

interface ShareBoardModalProps {
    open: boolean
    onClose: () => void
    boardId: string
    boardName?: string
}

export default function ShareBoardModal({ open, onClose, boardId, boardName }: ShareBoardModalProps) {
    const user = useSupabaseUser()
    const [shareInput, setShareInput] = useState('')
    const [selectedRole, setSelectedRole] = useState<'owner' | 'editor' | 'viewer'>('editor')
    const [searching, setSearching] = useState(false)
    const [results, setResults] = useState<Array<{ id: string; username?: string | null; email?: string | null; avatar_url?: string | null }>>([])
    const [shareInvites, setShareInvites] = useState<ShareInvite[]>([])
    const [shareError, setShareError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setShareInput('')
        setShareInvites([])
        setShareError(null)
    }, [open])

    useEffect(() => {
        const run = async () => {
            const q = shareInput.trim()
            if (q.length < 2) { setResults([]); return }
            setSearching(true)
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
                const json = await res.json()
                const list = Array.isArray(json.results) ? json.results : []
                setResults(list.filter((r: any) => r.id !== user?.id))
            } catch { setResults([]) }
            finally { setSearching(false) }
        }
        const t = setTimeout(run, 250)
        return () => clearTimeout(t)
    }, [shareInput, user?.id])

    const isValidEmail = (e: string) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(e)

    const addEmail = (email: string) => {
        const e = email.trim()
        if (!e || !isValidEmail(e)) { setShareError('Enter a valid email'); return }
        if (!shareInvites.some(inv => inv.email === e)) {
            setShareInvites(prev => [...prev, { email: e, role: selectedRole }])
        }
        setShareInput('')
        setShareError(null)
    }

    const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${boardId}`

    const handleSendInvites = async () => {
        setShareError(null)
        try {
            const invites = shareInvites.filter(i => isValidEmail(i.email))
            for (const { email, role } of invites) {
                await fetch('/api/board/invitations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ boardId, email, role, invitedBy: user?.id, boardName, boardUrl: shareLink })
                })
            }
            onClose()
        } catch {
            setShareError('Failed to send invites')
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Share Board" description="Copy a link or invite people by email.">
            <div className="space-y-6">
                <div>
                    <div className="flex gap-2 items-end">
                        <TextInput readOnly value={shareLink} fullWidth label="Share link" size="md" />
                        <IconButton aria-label="Copy share link" size="md" variant="secondary" onClick={() => { try { navigator.clipboard.writeText(shareLink) } catch { } }}>
                            <Copy size={24} weight="duotone" className="w-4 h-4" />
                        </IconButton>
                    </div>
                </div>

                <hr className="my-4" />

                <div>
                    <div className="flex flex-col sm:flex-row gap-2 items-end md:items-end space-y-2 md:space-y-0">
                        <div className="flex grow w-full">
                            <TextInput
                                type="email"
                                size="md"
                                fullWidth
                                placeholder="Add email and press Enter"
                                label="Invite by email"
                                value={shareInput}
                                onChange={e => setShareInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(shareInput) } }}
                            />
                        </div>

                        <div className="flex gap-2 items-end w-full sm:w-auto">
                            <Select
                                label="Role"
                                value={selectedRole}
                                onChange={(v: any) => setSelectedRole(v as any)}
                                options={[
                                    { label: 'Owner', value: 'owner' },
                                    { label: 'Editor', value: 'editor' },
                                    { label: 'Viewer', value: 'viewer' },
                                ]}
                                className="w-36 sm:w-40 flex-none"
                            />
                            <IconButton aria-label="Add email" size="md" variant="secondary" onClick={() => addEmail(shareInput)}>
                                <Plus size={24} className="w-4 h-4" />
                            </IconButton>
                        </div>
                    </div>
                    {shareError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{shareError}</div>}

                    {(searching || results.length > 0) && (
                        <div className="mt-2 border rounded-md border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-56 overflow-auto">
                            {searching && <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Searching…</div>}
                            {!searching && results.length === 0 && (
                                <div className="p-2 text-xs text-gray-500 dark:text-gray-400">No matches</div>
                            )}
                            {!searching && results.map((r) => (
                                <div key={r.id} className="p-2 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="text-sm text-gray-900 dark:text-white truncate">{r.username || r.email || r.id}</div>
                                        {r.email && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.email}</div>}
                                    </div>
                                    <Button size="sm" onClick={() => r.email && addEmail(r.email)} disabled={!r.email}>Share as {selectedRole}</Button>
                                </div>
                            ))}
                        </div>
                    )}
                    {shareInvites.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {shareInvites.map(inv => (
                                <Tag
                                    key={inv.email}
                                    variant="secondary"
                                    rightIcon={<XSquare className="w-3 h-3" />}
                                    onRightIconClick={() => setShareInvites(prev => prev.filter(e => e.email !== inv.email))}
                                >
                                    {inv.email} ({inv.role})
                                </Tag>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={handleSendInvites} disabled={shareInvites.length === 0}>Send Invites</Button>
                </div>
            </div>
        </Modal>
    )
}


