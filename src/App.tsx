import React, { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from '@/features/ai/aiContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Board from '@/features/board/Board'
import Topbar from './components/Topbar'
import TestPage from './components/TestPage'

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
              />
              <div className="pt-16 w-full h-full">
                <Board onBoardStateChange={handleBoardStateChange} />
              </div>
            </div>
          </ReactFlowProvider>
        </AIProvider>
      )}
    </ThemeProvider>
  )
}
