'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import BoardComponent from '../../../src/features/board/BoardComponent';
import { boardStorage } from '../../../src/features/storage/storage';
import type { SavedBoard } from '../../../src/features/storage/storage';
import { useSearchParams } from 'next/navigation';
import Loader from '../../../src/components/ui/Loader';

export default function BoardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const boardId = params.boardId as string;
  const [board, setBoard] = useState<SavedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader size="lg" className="mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
          Loading your board...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <BoardComponent 
        initialBoard={board ? { nodes: board.data.nodes, edges: board.data.edges } : undefined}
        onBoardStateChange={(name, status, hasChanges) => console.log('Board state:', { name, status, hasChanges })}
        screenshotMode={screenshotMode}
      />
    </div>
  );
} 