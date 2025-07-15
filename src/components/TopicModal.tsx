import React, { useState, useRef, useEffect } from 'react'

interface TopicModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (topic: string) => void
  defaultTopic?: string
  isFirstTime?: boolean
}

const topicSuggestions = [
  "What problem am I trying to solve?",
  "What am I learning about today?",
  "What decision do I need to make?",
  "What project am I planning?",
  "What concept am I exploring?",
  "What question am I researching?",
]

export default function TopicModal({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultTopic = '',
  isFirstTime = false
}: TopicModalProps) {
  const [topic, setTopic] = useState(defaultTopic)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTopic(defaultTopic)
      setError('')
      // Focus after modal opens
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          if (defaultTopic) {
            textareaRef.current.select()
          }
        }
      }, 100)
    }
  }, [isOpen, defaultTopic])

  const validateTopic = (topic: string): string | null => {
    const trimmed = topic.trim()
    
    if (!trimmed) {
      return 'Please enter a topic to get started'
    }
    
    if (trimmed.length < 3) {
      return 'Topic should be at least 3 characters'
    }
    
    if (trimmed.length > 200) {
      return 'Topic should be less than 200 characters'
    }
    
    return null
  }

  const handleSave = () => {
    const validationError = validateTopic(topic)
    
    if (validationError) {
      setError(validationError)
      return
    }
    
    onSave(topic.trim())
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTopic(e.target.value)
    if (error) {
      setError('')
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setTopic(suggestion)
    if (error) {
      setError('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isFirstTime ? 'Welcome to Nodal!' : 'Update Your Focus'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isFirstTime 
              ? 'What would you like to explore today?' 
              : 'What\'s your current focus for this board?'
            }
          </p>
        </div>
        
        {/* Main Content */}
        <div className="space-y-6">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Your Topic
            </label>
            <textarea
              ref={textareaRef}
              id="topic"
              value={topic}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="e.g., How to implement user authentication in React, Planning a product launch strategy, Understanding machine learning basics..."
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600 resize-none ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={3}
              maxLength={200}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {topic.length}/200 characters • Press Cmd+Enter to save
            </p>
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Need inspiration? Try one of these:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topicSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left p-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Helpful Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Don't worry about being perfect!</p>
                <p>Your topic can be a question you're trying to answer, something you're learning about, or any focus area. You can change it anytime, and it helps AI understand your context better.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-8">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {isFirstTime ? 'Skip for now' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!topic.trim()}
            className="px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isFirstTime ? 'Get Started' : 'Update Topic'}
          </button>
        </div>
      </div>
    </div>
  )
} 