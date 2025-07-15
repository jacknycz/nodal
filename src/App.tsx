import React, { useState } from 'react'
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isTestMode, setIsTestMode] = useState(false)

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
    // The Board component handles saving through its own modal
    // We'll trigger it via a custom event
    window.dispatchEvent(new CustomEvent('open-save-modal'))
  }

  const handleOpenBoardRoom = () => {
    // The Board component handles board room through its own modal
    // We'll trigger it via a custom event
    window.dispatchEvent(new CustomEvent('open-board-room'))
  }

  const handleExportBoard = () => {
    // The Board component handles export
    // We'll trigger it via a custom event
    window.dispatchEvent(new CustomEvent('export-board'))
  }

  const handleImportBoard = () => {
    // The Board component handles import
    // We'll trigger it via a custom event
    window.dispatchEvent(new CustomEvent('import-board'))
  }

  const handleOpenSettings = () => {
    // TODO: Implement settings modal
    alert('Settings modal coming soon!')
  }

  const handleLoadBoard = (board: SavedBoard) => {
    // This will be handled by the Board component through the BoardRoomModal
    console.log('Loading board:', board.name)
  }

  // Show loading state while checking authentication
  if (user === undefined) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
    )
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    )
  }

  // Show main app if authenticated
  return (
    <ThemeProvider>
      {isTestMode ? (
        <TestPage onExitTestMode={() => setIsTestMode(false)} />
      ) : (
        <AIProvider>
          <ReactFlowProvider>
            <div className="w-screen h-screen bg-gray-50 dark:bg-gray-900">
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
              <div className="pt-16 w-full h-full">
                <Board onBoardStateChange={handleBoardStateChange} />
              </div>
            </div>
            {/* <FloatingChat /> */}
          </ReactFlowProvider>
        </AIProvider>
      )}
    </ThemeProvider>
  )
}
