import React from 'react'
import { Button } from 'pres-start-core'

interface AddNodeButtonProps {
  onAddNode: () => void
  disabled?: boolean
}

export default function AddNodeButton({ onAddNode, disabled = false }: AddNodeButtonProps) {
  return (
    <Button
      onClick={onAddNode}
      disabled={disabled}
      className="fixed bg-black bottom-96 right-4 z-10 rounded-full w-12 h-12 shadow-lg"
    >
      +
    </Button>
  )
} 