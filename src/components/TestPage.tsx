import React, { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AIProvider } from '../features/ai/aiContext'
import Board from '../features/board/Board'
import Topbar from './Topbar'
import { useChat } from '../hooks/useChat'
import { Play, TestTube, Zap, Brain, Target, Users, Lightbulb, BarChart3 } from 'lucide-react'

interface TestScenario {
  id: string
  title: string
  description: string
  command: string
  icon: React.ReactNode
  category: 'basic' | 'advanced' | 'creative' | 'analysis'
}

const TEST_SCENARIOS: TestScenario[] = [
  // Basic Node Creation
  {
    id: 'create-single',
    title: 'Create Single Node',
    description: 'Test basic node creation with natural language',
    command: 'create a marketing node',
    icon: <Target className="w-4 h-4" />,
    category: 'basic'
  },
  {
    id: 'create-multiple',
    title: 'Create Multiple Nodes',
    description: 'Test batch node creation',
    command: 'create 3 nodes about user research',
    icon: <Users className="w-4 h-4" />,
    category: 'basic'
  },
  {
    id: 'create-specific',
    title: 'Create Specific Nodes',
    description: 'Test detailed node creation',
    command: 'create 5 marketing strategy nodes for a SaaS product',
    icon: <Lightbulb className="w-4 h-4" />,
    category: 'basic'
  },

  // Advanced Commands
  {
    id: 'analyze-board',
    title: 'Analyze Board',
    description: 'Test board analysis capabilities',
    command: '/analyze current board structure',
    icon: <BarChart3 className="w-4 h-4" />,
    category: 'analysis'
  },
  {
    id: 'project-planning',
    title: 'Project Planning',
    description: 'Test complex project planning',
    command: 'help me plan a complete mobile app development project',
    icon: <Brain className="w-4 h-4" />,
    category: 'advanced'
  },
  {
    id: 'brainstorm',
    title: 'Brainstorm Session',
    description: 'Test creative brainstorming',
    command: 'brainstorm 10 innovative features for a productivity app',
    icon: <Zap className="w-4 h-4" />,
    category: 'creative'
  },

  // Complex Operations
  {
    id: 'organize-nodes',
    title: 'Organize Existing Nodes',
    description: 'Test node organization and cleanup',
    command: 'organize my nodes by topic and priority',
    icon: <TestTube className="w-4 h-4" />,
    category: 'advanced'
  },
  {
    id: 'research-topic',
    title: 'Research & Analysis',
    description: 'Test research and analysis capabilities',
    command: 'research AI trends in 2024 and create a comprehensive analysis',
    icon: <Brain className="w-4 h-4" />,
    category: 'analysis'
  }
]

interface TestPageProps {
  onExitTestMode?: () => void
}

// Internal component that has access to chat context
function TestPageInternal({ onExitTestMode }: TestPageProps) {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({})
  const { sendMessage } = useChat()

  const runTest = async (scenario: TestScenario) => {
    setSelectedScenario(scenario)
    setTestResults(prev => ({ ...prev, [scenario.id]: 'pending' }))
    
    try {
      // Send the test command to Superman AI
      await sendMessage(scenario.command)
      setTestResults(prev => ({ ...prev, [scenario.id]: 'success' }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, [scenario.id]: 'error' }))
    }
  }

  const runAllTests = async () => {
    for (const scenario of TEST_SCENARIOS) {
      await runTest(scenario)
      // Wait a bit between tests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const getStatusColor = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'success': return 'bg-green-100 text-green-800 border-green-300'
      case 'error': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'basic': return 'bg-blue-50 border-blue-200'
      case 'advanced': return 'bg-purple-50 border-purple-200'
      case 'creative': return 'bg-green-50 border-green-200'
      case 'analysis': return 'bg-orange-50 border-orange-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="w-screen h-screen bg-gray-50 dark:bg-gray-900">
      <Topbar 
        isTestMode={true} 
        onToggleTestMode={onExitTestMode}
      />
      <div className="pt-16 w-full h-full flex">
      {/* Test Control Panel */}
      <div className="w-1/3 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <TestTube className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Superman AI Test Suite
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Test all Superman AI capabilities
              </p>
            </div>
          </div>

          <button
            onClick={runAllTests}
            className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run All Tests
          </button>

          <div className="space-y-4">
            {TEST_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${getCategoryColor(scenario.category)} hover:shadow-md`}
                onClick={() => runTest(scenario)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {scenario.icon}
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {scenario.title}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(testResults[scenario.id])}`}>
                    {testResults[scenario.id] || 'ready'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {scenario.description}
                </p>
                
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                  {scenario.command}
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {scenario.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Test Instructions */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              How to Test:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Click any test scenario to run it</li>
              <li>• Watch the board update in real-time</li>
              <li>• Check the chat panel for AI responses</li>
              <li>• Use "Run All Tests" for comprehensive testing</li>
            </ul>
          </div>
        </div>
      </div>

              {/* Test Environment */}
        <div className="flex-1 relative">
          <Board onBoardStateChange={() => {}} />

          {/* Test Status Overlay */}
          {selectedScenario && (
            <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                {selectedScenario.icon}
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Testing: {selectedScenario.title}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {selectedScenario.description}
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                {selectedScenario.command}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Status: {testResults[selectedScenario.id] || 'ready'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestPage({ onExitTestMode }: TestPageProps) {
  return (
    <AIProvider>
      <ReactFlowProvider>
        <TestPageInternal onExitTestMode={onExitTestMode} />
      </ReactFlowProvider>
    </AIProvider>
  )
} 