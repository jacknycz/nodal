import React, { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from './features/ai/aiContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Board from './features/board/Board'
import Topbar from './components/Topbar'
import TestPage from './components/TestPage'
import FloatingChat from './components/FloatingChat'
import { type SavedBoard } from './features/storage/storage'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export default function App() {
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
