import React from 'react'
import { Button, ButtonGroup, Heading } from 'pres-start-core'

interface ToolbarProps {
  onAddNode?: () => void
  onClearBoard?: () => void
  onExportBoard?: () => void
  onImportBoard?: () => void
}

export default function Toolbar({
  onAddNode,
  onClearBoard,
  onExportBoard,
  onImportBoard,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      <Heading size="h5" className="mb-3">Board Tools</Heading>
      
      <div className="space-y-2">
        <Button 
          onClick={onAddNode}
          className="w-full"
        >
          Add Node
        </Button>
        
        <ButtonGroup className="w-full">
          <Button 
            onClick={onExportBoard}
            className="flex-1"
          >
            Export
          </Button>
          <Button 
            onClick={onImportBoard}
            className="flex-1"
          >
            Import
          </Button>
        </ButtonGroup>
        
        <Button 
          onClick={onClearBoard}
          className="w-full text-red-600 hover:text-red-700"
        >
          Clear Board
        </Button>
      </div>
    </div>
  )
} 