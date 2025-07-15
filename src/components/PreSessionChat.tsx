import React, { useState } from 'react'
import type { BoardBrief } from '../features/board/boardTypes'

interface PreSessionChatProps {
  boardBrief: BoardBrief
  onReady: (chat: { role: 'user' | 'ai', content: string }[]) => void
}

export default function PreSessionChat({ boardBrief, onReady }: PreSessionChatProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([])
  const [input, setInput] = useState('')
  const [isReady, setIsReady] = useState(false)
  // For now, fake AI responses for testing
  const sendMessage = (msg: string) => {
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: `AI: Thanks for sharing! (echo: ${msg})` }])
    }, 800)
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage(input.trim())
      setInput('')
    }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Pre-Session Chat</h2>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          <div className="mb-2">Let's align before starting the board. Here’s your Board Brief:</div>
          <ul className="mb-2 pl-4 list-disc">
            <li><b>Topic:</b> {boardBrief.topic}</li>
            <li><b>Goal:</b> {boardBrief.goal}</li>
            <li><b>Audience:</b> {boardBrief.audience}</li>
            <li><b>Resources:</b> {boardBrief.resources.join(', ') || 'None'}</li>
            <li><b>AI Help:</b> {boardBrief.aiHelpPreferences.join(', ')}</li>
            {boardBrief.notes && <li><b>Notes:</b> {boardBrief.notes}</li>}
          </ul>
          <div className="mb-2">You and the AI can ask questions, clarify, or add context. When you’re ready, click “Start Board”.</div>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded p-3 mb-4 max-h-60">
          {messages.length === 0 && (
            <div className="text-gray-400 text-sm">No messages yet. Start the conversation!</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-3 py-2 rounded-lg text-sm max-w-xs ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input
            className="flex-1 px-3 py-2 border rounded-lg"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isReady}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            disabled={!input.trim() || isReady}
          >Send</button>
        </form>
        <button
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium mt-auto disabled:bg-gray-300"
          onClick={() => { setIsReady(true); onReady(messages) }}
          disabled={isReady}
        >
          Start Board
        </button>
      </div>
    </div>
  )
} 