import React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Board from '@/features/board/Board'
import './App.css'

export default function App() {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  )
}
