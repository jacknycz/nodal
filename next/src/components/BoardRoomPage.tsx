'use client'
import { useState } from 'react'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AIProvider } from '../features/ai/aiContext'
import Topbar from './Topbar'
import BoardRoom from './BoardRoom'
import Board from '../features/board/Board'
import LoginScreen from './LoginScreen'
import { useSupabaseUser } from '../features/auth/authUtils'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'

export default function BoardRoomPage() {
  const user = useSupabaseUser()
  const [currentView, setCurrentView] = useState<'boardroom' | 'board'>('boardroom')
  const [currentBoard, setCurrentBoard] = useState<SavedBoard | null>(null)
  const [pendingBoardBrief, setPendingBoardBrief] = useState<BoardBrief | null>(null)
  const [boardState, setBoardState] = useState({
    boardName: undefined as string | undefined,
    saveStatus: 'saved' as 'saved' | 'saving' | 'unsaved' | 'error',
    hasUnsavedChanges: false
  })

  console.log('[BoardRoomPage] user:', user)

  const handleOpenBoard = (board: SavedBoard | null, brief?: BoardBrief | null) => {
    console.log('Open board:', board, brief)
    if (board) {
      setCurrentBoard(board)
      setCurrentView('board')
    } else if (brief) {
      setPendingBoardBrief(brief)
      setCurrentView('board')
    }
  }

  const handleOpenBoardRoom = () => {
    setCurrentView('boardroom')
    setCurrentBoard(null)
    setPendingBoardBrief(null)
  }

  const handleBoardStateChange = (boardName: string | undefined, saveStatus: 'saved' | 'saving' | 'unsaved' | 'error', hasUnsavedChanges: boolean) => {
    setBoardState({ boardName, saveStatus, hasUnsavedChanges })
  }

  const clearPendingBoardBrief = () => {
    setPendingBoardBrief(null)
  }

  return (
    <ThemeProvider>
      <AIProvider>
        {user ? (
          <>
            <Topbar 
              currentBoardName={boardState.boardName} 
              isBoardView={currentView === 'board'}
              onOpenBoardRoom={handleOpenBoardRoom}
            />
            {currentView === 'boardroom' ? (
              <BoardRoom onOpenBoard={handleOpenBoard} />
            ) : (
              <Board 
                onBoardStateChange={handleBoardStateChange}
                initialBoard={currentBoard}
                onOpenBoardRoom={handleOpenBoardRoom}
                pendingBoardBrief={pendingBoardBrief}
                clearPendingBoardBrief={clearPendingBoardBrief}
              />
            )}
          </>
        ) : (
          <LoginScreen />
        )}
      </AIProvider>
    </ThemeProvider>
  )
} 