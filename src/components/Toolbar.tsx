import React from 'react'
import { Button, ButtonGroup, Heading } from 'pres-start-core'

interface ToolbarProps {
  onAddNode?: () => void
  onClearBoard?: () => void
  onExportBoard?: () => void
  onImportBoard?: () => void
  onOpenAIGenerator?: () => void
}

export default function Toolbar({
  onAddNode,
  onClearBoard,
  onExportBoard,
  onImportBoard,
  onOpenAIGenerator,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 backdrop-blur-sm bg-white/50 dark:bg-gray-900/70 rounded-4xl border border-gray-200 dark:border-gray-700 p-4">
      <Heading size="h5" className="mb-3 dark:text-white">Board Tools</Heading>
      
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