'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import BoardComponent from '../../../src/features/board/BoardComponent';
import { boardStorage } from '../../../src/features/storage/storage';
import type { SavedBoard } from '../../../src/features/storage/storage';
import { useSearchParams } from 'next/navigation';
import Loader from '../../../src/components/ui/Loader';
import { ThemeProvider } from '../../../src/contexts/ThemeContext';
import { AIProvider } from '../../../src/features/ai/aiContext';
import Topbar from '../../../src/components/Topbar';

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

  useEffect(() => {
    const loadBoard = async () => {
      try {
        setLoading(true);
        const loadedBoard = await boardStorage.loadBoard(boardId);
        if (loadedBoard) {
          setBoard(loadedBoard);
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

    if (boardId) {
      loadBoard();
    }
  }, [boardId]);

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
            />
          </div>
        )}
      </AIProvider>
    </ThemeProvider>
  );
} 