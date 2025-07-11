import { MessageSquare } from 'lucide-react'
import { useNodeSelection } from '../hooks/useNodeSelection'

interface AskAboutSelectionFABProps {
  onOpenChatWithSelection: (selectionContext: string) => void
}

export default function AskAboutSelectionFAB({ onOpenChatWithSelection }: AskAboutSelectionFABProps) {
  const { hasSelection, getSelectionSummary, getSelectionContext } = useNodeSelection()
  
  if (!hasSelection) return null
  
  const handleClick = () => {
    const context = getSelectionContext()
    onOpenChatWithSelection(context)
  }
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleClick}
        className="group bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        title={`Ask AI about selection: ${getSelectionSummary()}`}
      >
        <MessageSquare size={20} />
        <span className="text-sm font-medium">Ask AI about selection</span>
      </button>
    </div>
  )
} 