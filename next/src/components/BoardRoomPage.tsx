'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AIProvider } from '../features/ai/aiContext'
import Topbar from './Topbar'
import BoardRoom from './BoardRoom'
import BoardComponent from '../features/board/BoardComponent'
import LoginScreen from './LoginScreen'
import { useSupabaseUser } from '../features/auth/authUtils'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'

export default function BoardRoomPage() {
  const user = useSupabaseUser()
  const router = useRouter()
  const [currentBoard, _setCurrentBoard] = useState<SavedBoard | null>(null)
  const [pendingBoardBrief, setPendingBoardBrief] = useState<BoardBrief | null>(null)
  const [boardState, setBoardState] = useState({
    boardName: undefined as string | undefined,
    saveStatus: 'saved' as 'saved' | 'saving' | 'unsaved' | 'error',
    hasUnsavedChanges: false
  })
  
  // Ref to store the delete function from BoardComponent
  const deleteNodeRef = useRef<((nodeId: string) => void) | null>(null)

  const handleOpenBoard = async (board: SavedBoard | null, brief?: BoardBrief | null) => {
    console.log('Open board:', board, brief)
    if (board) {
      router.push(`/board/${board.id}`)
    } else if (brief) {
      setPendingBoardBrief(brief)
      // Set the board name for the pending board
      setBoardState(prev => ({
        ...prev,
        boardName: brief.boardName
      }))
    }
  }

  const handleOpenBoardRoom = () => {
    router.push('/')
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
    console.log('Manual save requested')
  }

  // Determine if we should show board view
  const isBoardView = pendingBoardBrief !== null

  return (
    <ThemeProvider>
      <AIProvider>
        {user ? (
          <>
            <Topbar 
              currentBoardName={boardState.boardName} 
              saveStatus={boardState.saveStatus}
              hasUnsavedChanges={boardState.hasUnsavedChanges}
              isBoardView={isBoardView}
              onOpenBoardRoom={handleOpenBoardRoom}
              onSaveBoard={handleManualSave}
            />
            {!isBoardView ? (
              <BoardRoom onOpenBoard={handleOpenBoard} />
            ) : (
              <BoardComponent 
                onBoardStateChange={handleBoardStateChange}
                initialBoard={currentBoard ? { nodes: currentBoard.data.nodes, edges: currentBoard.data.edges } : undefined}
                boardId={currentBoard?.id}
                boardName={currentBoard?.name}
                pendingBoardBrief={pendingBoardBrief || undefined}
                clearPendingBoardBrief={clearPendingBoardBrief}
                 onDeleteNode={(_nodeId) => {
                  deleteNodeRef.current = (_nodeId: string) => {
                    // This will be called by the BoardComponent
                  }
                }}
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