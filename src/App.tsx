import React, { useState, useEffect, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from './features/ai/aiContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Board from './features/board/Board'
import Topbar from './components/Topbar'
import TestPage from './components/TestPage'
import FloatingChat from './components/FloatingChat'
import LoginScreen from './components/LoginScreen'
import { useSupabaseUser } from './features/auth/authUtils'
import { useTheme } from './contexts/ThemeContext'
import nodalBlackLogo from './assets/nodal-black.svg'
import nodalWhiteLogo from './assets/nodal-white.svg'
import { type SavedBoard } from './features/storage/storage'
import BoardRoom from './components/BoardRoom'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

function LoadingScreen() {
  const { isDark } = useTheme()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 animate-pulse">
          <img 
            src={isDark ? nodalWhiteLogo : nodalBlackLogo} 
            alt="Nodal" 
            className="h-12 mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Loading Nodal...
        </h1>
      </div>
    </div>
  )
}

export default function App() {
  const user = useSupabaseUser()
  const [currentBoardName, setCurrentBoardName] = useState<string | undefined>(undefined)
  const [currentBoard, setCurrentBoard] = useState<any | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isTestMode, setIsTestMode] = useState(false)
  const [currentView, setCurrentView] = useState<'boardroom' | 'board'>('boardroom')
  const [isRestoringBoard, setIsRestoringBoard] = useState(false)
  const [hasCheckedSavedBoard, setHasCheckedSavedBoard] = useState(false)
  const previousUserRef = useRef<any>(null)

  const handleLoadBoard = (board: any) => {
    setCurrentBoard(board)
    setCurrentView('board')
    setCurrentBoardName(board.name)
    localStorage.setItem('nodal_current_board_id', board.id)
    localStorage.setItem('nodal_current_board_name', board.name)
  }

  useEffect(() => {
    if (previousUserRef.current && !user) {
      localStorage.removeItem('nodal_current_board_id')
      localStorage.removeItem('nodal_current_board_name')
      setCurrentView('boardroom')
      setCurrentBoard(undefined)
      setCurrentBoardName(undefined)
      setHasCheckedSavedBoard(false)
    }
    previousUserRef.current = user
  }, [user])

  useEffect(() => {
    if (user && currentView === 'boardroom' && !hasCheckedSavedBoard) {
      const savedBoardId = localStorage.getItem('nodal_current_board_id')
      const savedBoardName = localStorage.getItem('nodal_current_board_name')
      if (savedBoardId && savedBoardName) {
        setIsRestoringBoard(true)
        const loadSavedBoard = async () => {
          try {
            const { boardStorage } = await import('./features/storage/storage')
            const savedBoard = await boardStorage.loadBoard(savedBoardId)
            if (savedBoard) {
              handleLoadBoard(savedBoard)
            } else {
              localStorage.removeItem('nodal_current_board_id')
              localStorage.removeItem('nodal_current_board_name')
            }
          } catch (error) {
            localStorage.removeItem('nodal_current_board_id')
            localStorage.removeItem('nodal_current_board_name')
          } finally {
            setIsRestoringBoard(false)
            setHasCheckedSavedBoard(true)
          }
        }
        loadSavedBoard()
      } else {
        setHasCheckedSavedBoard(true)
      }
    }
  }, [user, currentView, hasCheckedSavedBoard])

  const handleBoardStateChange = (
    boardName: string | undefined,
    status: SaveStatus,
    unsavedChanges: boolean
  ) => {
    setCurrentBoardName(boardName)
    setSaveStatus(status)
    setHasUnsavedChanges(unsavedChanges)
  }

  const handleSaveBoard = () => {
    window.dispatchEvent(new CustomEvent('open-save-modal'))
  }

  const handleOpenBoardRoom = () => {
    setCurrentView('boardroom')
    localStorage.removeItem('nodal_current_board_id')
    localStorage.removeItem('nodal_current_board_name')
  }

  const handleExportBoard = () => {
    window.dispatchEvent(new CustomEvent('export-board'))
  }

  const handleImportBoard = () => {
    window.dispatchEvent(new CustomEvent('import-board'))
  }

  const handleOpenSettings = () => {
    alert('Settings modal coming soon!')
  }

  if (user === undefined) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
    )
  }

  if (!user) {
    return (
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    )
  }

  if (isRestoringBoard) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {isTestMode ? (
        <TestPage onExitTestMode={() => setIsTestMode(false)} />
      ) : (
        <AIProvider>
          <ReactFlowProvider>
            <div className="w-screen h-screen bg-gray-50 dark:bg-gray-900 h-full">
              <Topbar 
                currentBoardName={currentBoardName}
                saveStatus={saveStatus}
                hasUnsavedChanges={hasUnsavedChanges}
                isTestMode={isTestMode}
                onToggleTestMode={() => setIsTestMode(!isTestMode)}
                onSaveBoard={handleSaveBoard}
                onOpenBoardRoom={handleOpenBoardRoom}
                onExportBoard={handleExportBoard}
                onImportBoard={handleImportBoard}
                onOpenSettings={handleOpenSettings}
                onLoadBoard={handleLoadBoard}
              />
              <div className="pt-16 w-full min-h-dvh h-full">
                {currentView === 'boardroom' ? (
                  <BoardRoom onOpenBoard={handleLoadBoard} />
                ) : (
                  <Board 
                    onBoardStateChange={handleBoardStateChange} 
                    initialBoard={currentBoard}
                    onOpenBoardRoom={handleOpenBoardRoom}
                  />
                )}
              </div>
            </div>
            {/* <FloatingChat /> */}
          </ReactFlowProvider>
        </AIProvider>
      )}
    </ThemeProvider>
  )
}
