'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Board from '../../../src/features/board/Board';
import { boardStorage } from '../../../src/features/storage/storage';
import type { SavedBoard } from '../../../src/features/storage/storage';

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  const [board, setBoard] = useState<SavedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center">
        <span>Loading board...</span>
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
      <Board 
        initialBoard={board ? { nodes: board.data.nodes, edges: board.data.edges } : undefined}
        onBoardStateChange={(name, status, hasChanges) => console.log('Board state:', { name, status, hasChanges })}
      />
    </div>
  );
} 