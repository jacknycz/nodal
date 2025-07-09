import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from '@/features/ai/aiContext'
import Board from '@/features/board/Board'
import './App.css'

export default function App() {
  return (
    <AIProvider>
      <ReactFlowProvider>
        <Board />
      </ReactFlowProvider>
    </AIProvider>
  )
}
