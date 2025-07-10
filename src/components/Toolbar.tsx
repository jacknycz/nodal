import React from 'react'
import { Button, ButtonGroup, Heading } from 'pres-start-core'

interface ToolbarProps {
  onAddNode?: () => void
  onClearBoard?: () => void
  onExportBoard?: () => void
  onImportBoard?: () => void
  onOpenAIGenerator?: () => void
  onSaveBoard?: () => void
  currentBoardName?: string
}

export default function Toolbar({
  onAddNode,
  onClearBoard,
  onExportBoard,
  onImportBoard,
  onOpenAIGenerator,
  onSaveBoard,
  currentBoardName,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 backdrop-blur-sm bg-white/50 dark:bg-gray-900/70 rounded-4xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="mb-3">
        <Heading size="h5" className="dark:text-white">Board Tools</Heading>
        {currentBoardName && (
          <div className="flex items-center mt-1 text-xs text-gray-600 dark:text-gray-400">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate max-w-[140px]" title={currentBoardName}>
              {currentBoardName}
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <Button 
          onClick={onAddNode}
          className="w-full bg-primary-500 dark:bg-primary-700 text-white"
          variant="primary"
        >
          Add Node
        </Button>

        <Button 
          onClick={onOpenAIGenerator}
          className="w-full bg-primary-500 dark:bg-primary-700 text-white"
          variant="primary"
        >
          AI Generate
        </Button>

        <Button 
          onClick={onSaveBoard}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          variant="primary"
        >
          Save Board
        </Button>
        
        <ButtonGroup className="w-full gap-4">
          <Button 
            onClick={onExportBoard}
            className="flex-1 bg-primary-500 dark:bg-primary-700 text-white"
            variant="primary"
          >
            Export
          </Button>

          <Button 
            onClick={onImportBoard}
            className="flex-1 bg-primary-500 dark:bg-primary-700 text-white"
            variant="primary"
          >
            Import
          </Button>
        </ButtonGroup>
        
        <Button 
          onClick={onClearBoard}
          className="w-full bg-primary-500 dark:bg-primary-700 text-white"
          variant="primary"
        >
          Clear Board
        </Button>
      </div>
    </div>
  )
} 