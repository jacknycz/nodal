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
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      <Heading size="h5" className="mb-3 text-black">Board Tools</Heading>
      
      <div className="space-y-2">
        <Button 
          onClick={onAddNode}
          className="w-full"
          variant="custom"
        >
          Add Node
        </Button>

        <Button 
          onClick={onOpenAIGenerator}
          variant="custom"
          className="w-full"
        >
          🤖 AI Generate
        </Button>
        
        <ButtonGroup className="w-full">
          <Button 
            onClick={onExportBoard}
            className="flex-1"
            variant="custom"
          >
            Export
          </Button>
          <Button 
            onClick={onImportBoard}
            className="flex-1"
            variant="custom"
          >
            Import
          </Button>
        </ButtonGroup>
        
        <Button 
          onClick={onClearBoard}
          className="w-full"
          variant="custom"
        >
          Clear Board
        </Button>
      </div>
    </div>
  )
} 