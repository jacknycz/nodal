import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from '@/features/ai/aiContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Board from '@/features/board/Board'
import Topbar from './components/Topbar'

export default function App() {
  return (
    <ThemeProvider>
      <AIProvider>
        <ReactFlowProvider>
          <div className="w-screen h-screen bg-gray-50 dark:bg-gray-900">
            <Topbar />
            <div className="pt-16 w-full h-full">
              <Board />
            </div>
          </div>
        </ReactFlowProvider>
      </AIProvider>
    </ThemeProvider>
  )
}
