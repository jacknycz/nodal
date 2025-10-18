'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabaseUser } from '../../../src/features/auth/authUtils'
import { useRouter } from 'next/navigation'
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

  // Redirect unauthenticated users to login (root), but avoid transient flicker on session refresh
  useEffect(() => {
    if (user === undefined) return // auth still resolving
    if (user && (user as any).id) {
      try { localStorage.setItem('nodal.auth.hadUser', 'true') } catch {}
      return
    }
    // user is null here
    const hadUser = typeof window !== 'undefined' ? localStorage.getItem('nodal.auth.hadUser') === 'true' : false
    if (!hadUser) {
      router.replace('/')
    }
    // If hadUser was true, skip redirect to prevent flash when session briefly resets on focus
  }, [user, router])

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
    if (!user || !(user as any).id) return // wait for stable authenticated user
    loadBoard();
  }, [boardId, user?.id]);

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

  return (
    <ThemeProvider>
      <AIProvider>
        <div className="h-screen relative">
          {/* Hide topbar in editor mode */}
          <div className={editorMode ? 'hidden' : ''}>
            <Topbar
              currentBoardName={board?.name}
              saveStatus={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              isBoardView={true}
              onOpenBoardRoom={handleOpenBoardRoom}
            />
          </div>
          <BoardComponent
            key={board ? `${boardId}-ready` : `${boardId}-loading`}
            initialBoard={board ? { nodes: board.data.nodes, edges: board.data.edges } : undefined}
            onBoardStateChange={handleBoardStateChange}
            screenshotMode={screenshotMode}
            boardId={boardId}
          />

          {/* Loading overlay over board (not fullscreen blockout) */}
          {loading && (
            <div className="fixed inset-0 z-[950] flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm">
              <div className="px-4 py-3 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <Loader size="md" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Loading your board…</span>
              </div>
            </div>
          )}

          {/* Error overlay (keeps UI visible) */}
          {!loading && error && (
            <div className="fixed inset-0 z-[950] flex items-center justify-center">
              <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm shadow">
                Error loading board: {error}
              </div>
            </div>
          )}
        </div>
      </AIProvider>
    </ThemeProvider>
  );
} 