import React, { useState, useRef, useEffect } from 'react'
import { Button, Heading } from 'pres-start-core'
import { useAINodeGenerator } from '../features/ai/useAINodeGenerator'
import { useBoard } from '../features/board/useBoard'
import { useAIConfig } from '../features/ai/aiContext'
import type { OpenAIModel } from '../features/ai/aiTypes'
import type { AINodeGeneratorOptions } from '../features/ai/useAINodeGenerator'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'

// Simple UI components as replacements
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow-lg border border-gray-200 p-6 ${className}`}>
    {children}
  </div>
)

const Label = ({ children, htmlFor, className = '' }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-700 mb-1 ${className}`}>
    {children}
  </label>
)

const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`} {...props} />
)

const Select = ({ children, className = '', value, onChange, onValueChange, disabled, id }: { 
  children: React.ReactNode; 
  className?: string; 
  value: string; 
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; 
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) => (
  <select 
    id={id}
    value={value} 
    onChange={(e) => {
      onChange?.(e)
      onValueChange?.(e.target.value)
    }} 
    disabled={disabled}
    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
  >
    {children}
  </select>
)

// Simple icons as text
const Plus = ({ className = '' }: { className?: string }) => <span className={className}>+</span>
const Grid = ({ className = '' }: { className?: string }) => <span className={className}>⊞</span>
const LinkIcon = ({ className = '' }: { className?: string }) => <span className={className}>🔗</span>
const Target = ({ className = '' }: { className?: string }) => <span className={className}>⊙</span>
const AlertCircle = ({ className = '' }: { className?: string }) => <span className={className}>⚠</span>
const Zap = ({ className = '' }: { className?: string }) => <span className={className}>⚡</span>

interface AINodeGeneratorProps {
  isOpen?: boolean
  onClose?: () => void
  className?: string
}

type GenerationMode = 'single' | 'contextual' | 'bridge' | 'cluster'

const GENERATION_MODES = [
  { value: 'single', label: 'Single Node', description: 'Generate one node from your prompt', icon: Plus },
  { value: 'contextual', label: 'Contextual Nodes', description: 'Generate multiple nodes based on board context', icon: Grid },
  { value: 'bridge', label: 'Bridge Node', description: 'Connect two selected nodes with a bridge concept', icon: LinkIcon },
  { value: 'cluster', label: 'Related Cluster', description: 'Generate nodes around a selected center node', icon: Target }
] as const

const MODELS: Array<{ value: OpenAIModel; label: string; description: string }> = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and cost-effective' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Latest high-performance model' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Advanced reasoning' },
  { value: 'gpt-4', label: 'GPT-4', description: 'High-quality responses' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Quick and efficient' }
]

const POSITION_STRATEGIES = [
  { value: 'center', label: 'Center', description: 'Place nodes at viewport center' },
  { value: 'circular', label: 'Circular', description: 'Arrange nodes in a circle' },
  { value: 'grid', label: 'Grid', description: 'Organize nodes in a grid pattern' },
  { value: 'connected', label: 'Connected', description: 'Place around selected node' }
] as const

export default function AINodeGenerator({ isOpen = true, onClose, className = '' }: AINodeGeneratorProps) {
  const { generateNode, generateContextualNodes, generateBridgeNode, generateRelatedCluster, isGenerating, error } = useAINodeGenerator()
  const { nodes, selectedNode } = useBoard()
  const { getConfigurationStatus, config } = useAIConfig()
  const aiSettings = useAISettingsStore()
  
  const configStatus = getConfigurationStatus()
  const isConfigured = configStatus.configured
  
  const [mode, setMode] = useState<GenerationMode>('single')
  const [prompt, setPrompt] = useState('')
  // Use global settings as defaults
  const [model, setModel] = useState<OpenAIModel>(aiSettings.model)
  const allowedStrategies = ['center', 'grid', 'circular', 'connected'] as const;
  type AllowedStrategy = typeof allowedStrategies[number];
  const [positionStrategy, setPositionStrategy] = useState<AllowedStrategy>('center');
  const [temperature, setTemperature] = useState<number>(aiSettings.temperature)
  const [nodeCount, setNodeCount] = useState(3)
  const [includeContext, setIncludeContext] = useState(true)
  const [lastResult, setLastResult] = useState<string | string[] | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // Focus prompt input when component opens
  useEffect(() => {
    if (isOpen && promptInputRef.current) {
      promptInputRef.current.focus()
    }
  }, [isOpen])

  // Reset last result when mode changes
  useEffect(() => {
    setLastResult(null)
  }, [mode])

  // Sync with global settings
  useEffect(() => { setModel(aiSettings.model) }, [aiSettings.model])
  useEffect(() => {
    if (allowedStrategies.includes(aiSettings.positionStrategy as AllowedStrategy)) {
      setPositionStrategy(aiSettings.positionStrategy as AllowedStrategy);
    }
  }, [aiSettings.positionStrategy]);
  useEffect(() => { setTemperature(aiSettings.temperature) }, [aiSettings.temperature])

  const handleGenerate = async () => {
    if (!prompt.trim() && mode === 'single') return
    if (!isConfigured) {
      alert('Please configure your OpenAI API key first.')
      return
    }

    const options: AINodeGeneratorOptions = {
      model,
      includeContext,
      positionStrategy,
      temperature
    }

    setLastResult(null)
    
    try {
      switch (mode) {
        case 'single':
          const singleResult = await generateNode(prompt, options)
          setLastResult(singleResult)
          break
          
        case 'contextual':
          const contextualResults = await generateContextualNodes(nodeCount, options)
          setLastResult(contextualResults)
          break
          
        case 'bridge':
          if (nodes.length < 2) {
            alert('You need at least 2 nodes on the board to create a bridge.')
            return
          }
          // For simplicity, use first two nodes or selected + another
          const sourceNode = selectedNode || nodes[0]
          const targetNode = nodes.find(n => n.id !== sourceNode.id) || nodes[1]
          const bridgeResult = await generateBridgeNode(sourceNode.id, targetNode.id, options)
          setLastResult(bridgeResult)
          break
          
        case 'cluster':
          if (!selectedNode) {
            alert('Please select a node to generate a cluster around.')
            return
          }
          const clusterResults = await generateRelatedCluster(selectedNode.id, nodeCount, options)
          setLastResult(clusterResults)
          break
      }
      
      // Clear prompt on successful generation (for single mode)
      if (mode === 'single') {
        setPrompt('')
      }
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  const canGenerate = () => {
    if (!isConfigured) return false
    if (isGenerating) return false
    
    switch (mode) {
      case 'single':
        return prompt.trim().length > 0
      case 'contextual':
        return nodes.length > 0
      case 'bridge':
        return nodes.length >= 2
      case 'cluster':
        return selectedNode !== null
      default:
        return false
    }
  }

  const getButtonText = () => {
    if (isGenerating) return 'Generating...'
    
    switch (mode) {
      case 'single':
        return 'Generate Node'
      case 'contextual':
        return `Generate ${nodeCount} Contextual Nodes`
      case 'bridge':
        return 'Generate Bridge Node'
      case 'cluster':
        return `Generate ${nodeCount} Related Nodes`
      default:
        return 'Generate'
    }
  }

  const renderModeSelector = () => (
    <div className="space-y-3">
      <Label>Generation Mode</Label>
      <div className="grid grid-cols-2 gap-2">
        {GENERATION_MODES.map(({ value, label, description, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              mode === value 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <Icon className="w-4 h-4" />
              <span className="font-medium text-sm">{label}</span>
            </div>
            <p className="text-xs text-gray-600">{description}</p>
          </button>
        ))}
      </div>
    </div>
  )

  const renderPromptInput = () => {
    if (mode !== 'single') return null
    
    return (
      <div className="space-y-2">
        <Label htmlFor="prompt">Describe the node you want to create</Label>
        <textarea
          ref={promptInputRef}
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., 'A concept about machine learning algorithms' or 'The relationship between data and insights'"
          className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isGenerating}
        />
      </div>
    )
  }

  const renderContextualInfo = () => {
    switch (mode) {
      case 'contextual':
        return (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Will generate {nodeCount} nodes based on the {nodes.length} existing nodes on your board.
              {nodes.length === 0 && ' Add some nodes first to provide context.'}
            </p>
          </div>
        )
      case 'bridge':
        return (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700">
              Will create a connecting concept between {
                selectedNode ? `"${selectedNode.data.label}"` : 'the first node'
              } and another node on your board.
              {nodes.length < 2 && ' You need at least 2 nodes on the board.'}
            </p>
          </div>
        )
      case 'cluster':
        return (
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">
              Will generate {nodeCount} related nodes around {
                selectedNode ? `"${selectedNode.data.label}"` : 'the selected node'
              }.
              {!selectedNode && ' Please select a node first.'}
            </p>
          </div>
        )
      default:
        return null
    }
  }

  // Remove advanced controls for model, position, temperature
  const renderAdvancedSettings = () => {
    if (!showAdvanced) return null
    return (
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
          Model, position strategy, and creativity are now set in the top bar AI settings menu.
        </div>
        {/* Keep other advanced settings if any */}
        <div className="flex items-center space-x-2">
          <input
            id="includeContext"
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
            disabled={isGenerating}
            className="rounded"
          />
          <Label htmlFor="includeContext" className="text-sm">
            Include board context in generation
          </Label>
        </div>
      </div>
    )
  }

  const renderResults = () => {
    if (!lastResult) return null
    
    const resultArray = Array.isArray(lastResult) ? lastResult : [lastResult]
    
    return (
      <div className="space-y-2">
        <Label>Generated Nodes</Label>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="text-sm text-green-700">
            ✅ Successfully generated {resultArray.length} node{resultArray.length > 1 ? 's' : ''}:
          </div>
          <ul className="mt-2 space-y-1">
            {resultArray.map((title, index) => (
              <li key={index} className="text-sm font-medium text-green-800">
                • {title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const renderAPIKeyStatus = () => {
    if (!isConfigured) {
      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              OpenAI API key not configured. Please set it up to use AI generation.
            </span>
          </div>
        </div>
      )
    }
    
    return (
      <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">
            AI ready ({config?.defaultModel || 'default model'})
          </span>
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Heading size="h4">AI Node Generator</Heading>
            {onClose && (
              <Button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </Button>
            )}
          </div>

          {/* API Key Status */}
          {renderAPIKeyStatus()}

          {/* Mode Selection */}
          {renderModeSelector()}

          {/* Contextual Information */}
          {renderContextualInfo()}

          {/* Prompt Input (for single mode) */}
          {renderPromptInput()}

          {/* Advanced Settings Toggle */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </button>
          </div>

          {/* Advanced Settings */}
          {renderAdvancedSettings()}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Results */}
          {renderResults()}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate()}
            className={`w-full ${
              canGenerate() && !isGenerating
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {getButtonText()}
          </Button>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center">
            Generated nodes will be marked with AI indicators and positioned based on your strategy.
          </div>
        </div>
      </Card>
    </div>
  )
} 