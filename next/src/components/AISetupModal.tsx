'use client'

import React, { useState } from 'react'
import { useAIContext } from '../features/ai/aiContext'
import { X, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface AISetupModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AISetupModal({ isOpen, onClose }: AISetupModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  
  const aiContext = useAIContext()

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return

    setIsTesting(true)
    setTestResult(null)
    setErrorMessage('')

    try {
      const success = await aiContext.initialize(apiKey.trim())
      if (success) {
        setTestResult('success')
        // Auto-close after successful setup
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setTestResult('error')
        setErrorMessage('Failed to initialize AI service')
      }
    } catch (err) {
      setTestResult('error')
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return
    await handleTestConnection()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                AI Setup
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure your OpenAI API key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your API key is stored locally and never sent to our servers
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center space-x-2">
                {testResult === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <span className={`text-sm ${
                  testResult === 'success' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {testResult === 'success' 
                    ? 'AI service configured successfully!' 
                    : errorMessage || 'Failed to configure AI service'
                  }
                </span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              How to get your API key:
            </h4>
            <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Platform</a></li>
              <li>2. Sign in or create an account</li>
              <li>3. Click &quot;Create new secret key&quot;</li>
              <li>4. Copy the key (starts with &quot;sk-&quot;)</li>
              <li>5. Paste it above and test the connection</li>
            </ol>
          </div>

          {/* Privacy Notice */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Privacy:</strong> Your API key is stored locally in your browser. 
              We never see or store your API key on our servers. 
              All AI requests are made directly from your browser to OpenAI.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || isTesting}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Test & Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 