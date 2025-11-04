'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabaseUser } from '../../../src/features/auth/authUtils'
import { getSupabaseClient } from '../../../src/features/auth/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BoardComponent from '../../../src/features/board/BoardComponent';
import { boardStorage } from '../../../src/features/storage/storage';
import type { SavedBoard } from '../../../src/features/storage/storage';
import { useSearchParams } from 'next/navigation';
import Loader from '../../../src/components/ui/Loader';
import { ThemeProvider } from '../../../src/contexts/ThemeContext';
import { AIProvider } from '../../../src/features/ai/aiContext';
import Topbar from '../../../src/components/Topbar';
import { useEffect as useEffect2 } from 'react';
import { useBoardStore } from '../../../src/features/board/boardSlice';
import Toast from '../../../src/components/ui/Toast'

export default function BoardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const boardId = params.boardId as string;
  const [board, setBoard] = useState<SavedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const screenshotMode = searchParams.get('screenshot') === 'true';
  const user = useSupabaseUser()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [canEdit, setCanEdit] = useState(false)

  // Do not redirect unauthenticated users; allow viewing public boards

  useEffect(() => {
    const loadBoard = async () => {
      try {
        // If board already loaded, avoid flashing the screen again
        setLoading(prev => (board ? prev : true));
        const loadedBoard = await boardStorage.loadBoard(boardId);
        if (loadedBoard) {
          setBoard(loadedBoard);
          // eslint-disable-next-line no-console
          console.log('Loaded board from storage:', loadedBoard)
          // Hydrate local chat state from board meta if present
          try {
            const chatMeta = loadedBoard.data?.meta?.chat
            if (chatMeta && typeof window !== 'undefined') {
              if (Array.isArray(chatMeta.messages)) {
                localStorage.setItem(`nodal.chat.${boardId}`, JSON.stringify(chatMeta.messages))
              }
              if (typeof chatMeta.panelOpen === 'boolean') {
                localStorage.setItem(`nodal.chatpanel.${boardId}.open`, chatMeta.panelOpen ? 'true' : 'false')
              }
              if (typeof chatMeta.model === 'string' && chatMeta.model) {
                localStorage.setItem(`nodal.chatpanel.${boardId}.model`, chatMeta.model)
              }
            }
          } catch {}
        } else {
          setError('Board not found');
        }
      } catch (err) {
        console.error('Error loading board:', err);
        setError('Failed to load board');
      } finally {
        setLoading(false);
      }
    };

    if (!boardId) return
    loadBoard();
  }, [boardId]);

  // Determine whether current user can edit this board (owner or editor member)
  useEffect(() => {
    const check = async () => {
      try {
        if (!boardId || !board) { setCanEdit(false); return }
        if (!user?.id) { setCanEdit(false); return }
        if (board.userId && user.id === board.userId) { setCanEdit(true); return }
        // Use server route to avoid RLS issues
        const res = await fetch(`/api/board/members?boardId=${encodeURIComponent(boardId)}`)
        if (!res.ok) { setCanEdit(false); return }
        const json = await res.json()
        const me = (Array.isArray(json.members) ? json.members : []).find((m: any) => m.user_id === user.id)
        const role = me?.role as string | undefined
        setCanEdit(role === 'owner' || role === 'editor')
      } catch {
        setCanEdit(false)
      }
    }
    check()
  }, [boardId, board, user?.id])

  // Reflect runtime board name changes (e.g., via BoardSettingsModal)
  useEffect(() => {
    const onName = (ev: any) => {
      const id = ev?.detail?.boardId as string | undefined
      const name = ev?.detail?.name as string | undefined
      if (!id || !name) return
      if (id !== boardId) return
      setBoard(prev => (prev ? { ...prev, name } as SavedBoard : prev))
    }
    window.addEventListener('nodal:board-name-updated', onName as EventListener)
    return () => window.removeEventListener('nodal:board-name-updated', onName as EventListener)
  }, [boardId])

  // Sync loaded board topic into the board store so Topbar can read it
  useEffect2(() => {
    if (board && typeof window !== 'undefined') {
      useBoardStore.getState().setTopic(board.data?.topic ?? null)
    }
  }, [board])

  // Update save status and unsaved changes from BoardComponent
  const handleBoardStateChange = (name: string, status: string, hasChanges: boolean) => {
    setSaveStatus(status as 'saved' | 'saving' | 'unsaved' | 'error');
    setHasUnsavedChanges(hasChanges);
  };

  const handleOpenBoardRoom = () => {
    window.location.href = '/';
  };

  // Listen for editor-mode to hide Topbar
  const [editorMode, setEditorMode] = useState(false)
  useEffect(() => {
    const handler = (e: any) => setEditorMode(!!e?.detail?.open)
    window.addEventListener('nodal:editor-mode', handler as EventListener)
    return () => window.removeEventListener('nodal:editor-mode', handler as EventListener)
  }, [])

  const isAccessBlocked = !loading && !board
  const isPublicViewer = !!board?.isPublic && !user?.id
  return (
    <ThemeProvider>
      <AIProvider>
        <div className="h-screen relative">
          {/* Hide topbar in editor mode or when access is blocked (private board) */}
          <div className={(editorMode || isAccessBlocked) ? 'hidden' : ''}>
            <Topbar
              currentBoardName={board?.name}
              saveStatus={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              isBoardView={true}
              onOpenBoardRoom={handleOpenBoardRoom}
              publicViewer={isPublicViewer}
            />
          </div>
          {board ? (
            <BoardComponent
              key={`${boardId}-ready`}
              initialBoard={{ nodes: board.data.nodes, edges: board.data.edges }}
              onBoardStateChange={handleBoardStateChange}
              screenshotMode={screenshotMode}
              boardId={boardId}
              readOnly={!canEdit}
            />
          ) : (
            <div className="h-full" />
          )}

          {/* Loading toast */}
          <Toast open={loading} variant="info" position="top-center">
            <div className="flex items-center gap-2">
              <Loader size="sm" />
              <span className="text-sm leading-none">Loading your board…</span>
            </div>
          </Toast>

          {/* Error overlay (keeps UI visible) */}
          {!loading && !board && (
            <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-white dark:bg-black">
              <div className="px-6 py-4 rounded-xl bg-white/95 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 text-center shadow">
                <div className="text-base font-semibold text-gray-900 dark:text-white mb-1">This board is private</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">You don't have access. Log in or ask the owner to invite you.</div>
                <Link href="/" className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-primary-600 text-white text-sm">Log in</Link>
              </div>
            </div>
          )}
        </div>
      </AIProvider>
    </ThemeProvider>
  );
} 