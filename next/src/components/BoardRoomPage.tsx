'use client'
import { ThemeProvider } from '../contexts/ThemeContext'
import Topbar from './Topbar'
import BoardRoom from './BoardRoom'
import LoginScreen from './LoginScreen'
import { useSupabaseUser } from '../features/auth/authUtils'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'

export default function BoardRoomPage() {
  const user = useSupabaseUser()
  console.log('[BoardRoomPage] user:', user)
  const handleOpenBoard = (board: SavedBoard | null, brief?: BoardBrief | null) => {
    console.log('Open board:', board, brief)
    // TODO: Route to board view or set state to show the board
  }

  return (
    <ThemeProvider>
      {user ? (
        <>
          <Topbar currentBoardName="Test Board" isBoardView={true} />
          <BoardRoom onOpenBoard={handleOpenBoard} />
        </>
      ) : (
        <LoginScreen />
      )}
    </ThemeProvider>
  )
} 