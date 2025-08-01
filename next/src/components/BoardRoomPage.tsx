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
import { boardStorage } from '../features/storage/storage'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'

export default function BoardRoomPage() {
  const user = useSupabaseUser()
  const router = useRouter()
  const [currentBoard, setCurrentBoard] = useState<SavedBoard | null>(null)
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
      // Optionally, you could push a URL for a new/unsaved board here
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
              isBoardView={false} // This can be improved if you want to detect board view from URL
              onOpenBoardRoom={handleOpenBoardRoom}
              onSaveBoard={handleManualSave}
            />
            <BoardRoom onOpenBoard={handleOpenBoard} />
          </>
        ) : (
          <LoginScreen />
        )}
      </AIProvider>
    </ThemeProvider>
  )
}
