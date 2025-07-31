'use client'
import { useState } from 'react'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AIProvider } from '../features/ai/aiContext'
import Topbar from './Topbar'
import BoardRoom from './BoardRoom'
import BoardComponent from '../features/board/BoardComponent'
import LoginScreen from './LoginScreen'
import { useSupabaseUser } from '../features/auth/authUtils'
import { boardStorage } from '../features/storage/storage'
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

  const handleOpenBoard = async (board: SavedBoard | null, brief?: BoardBrief | null) => {
    console.log('Open board:', board, brief)
    if (board) {
      // Existing board - just open it
      setCurrentBoard(board)
      setCurrentView('board')
      // Set the board name for existing boards
      setBoardState(prev => ({
        ...prev,
        boardName: board.name
      }))
    } else if (brief) {
      // New board - just set the brief and switch to board view
      setPendingBoardBrief(brief)
      setCurrentView('board')
    }
  }

  const handleOpenBoardRoom = () => {
    setCurrentView('boardroom')
    setCurrentBoard(null)
    setPendingBoardBrief(null)
  }

  const handleBoardStateChange = (boardName: string, saveStatus: string, hasUnsavedChanges: boolean) => {
    setBoardState({ 
      boardName, 
      saveStatus: saveStatus as 'saved' | 'saving' | 'unsaved' | 'error', 
      hasUnsavedChanges 
    })
  }

  const clearPendingBoardBrief = () => {
    setPendingBoardBrief(null)
  }

  const handleManualSave = () => {
    // This will be handled by the BoardComponent
    console.log('Manual save requested')
  }

  return (
    <ThemeProvider>
      <AIProvider>
        {user ? (
          <>
            <Topbar 
              currentBoardName={boardState.boardName} 
              saveStatus={boardState.saveStatus}
              hasUnsavedChanges={boardState.hasUnsavedChanges}
              isBoardView={currentView === 'board'}
              onOpenBoardRoom={handleOpenBoardRoom}
              onSaveBoard={handleManualSave}
            />
            {currentView === 'boardroom' ? (
              <BoardRoom onOpenBoard={handleOpenBoard} />
            ) : (
              <BoardComponent 
                onBoardStateChange={handleBoardStateChange}
                initialBoard={currentBoard ? { nodes: currentBoard.data.nodes, edges: currentBoard.data.edges } : undefined}
                boardId={currentBoard?.id}
                boardName={currentBoard?.name}
                pendingBoardBrief={pendingBoardBrief || undefined}
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
