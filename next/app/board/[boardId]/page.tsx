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

  return (
    <ThemeProvider>
      <AIProvider>
        {loading ? (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Loader size="lg" className="mb-4" />
            <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
              Loading your board...
            </p>
          </div>
        ) : error ? (
          <div className="min-h-screen flex items-center justify-center">
            <span>Error: {error}</span>
          </div>
        ) : (
          <div className="h-screen">
            <Topbar
              currentBoardName={board?.name}
              saveStatus={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              isBoardView={true}
              onOpenBoardRoom={handleOpenBoardRoom}
            />
            <BoardComponent 
              initialBoard={board ? { nodes: board.data.nodes, edges: board.data.edges } : undefined}
              onBoardStateChange={handleBoardStateChange}
              screenshotMode={screenshotMode}
              boardId={boardId} // <-- Pass boardId prop
            />
          </div>
        )}
      </AIProvider>
    </ThemeProvider>
  );
} 