import { useState, useCallback, useRef, useEffect } from 'react'
import { useBoard } from '../features/board/useBoard'
import { useAI } from '../features/ai/useAI'
import { useAIContext } from '../features/ai/aiContext'
import { useAINodeGenerator } from '../features/ai/useAINodeGenerator'
import { useBoardAI } from '../features/ai/useAI'
import { useViewportCenter } from './useViewportCenter'
import { boardStorage } from '../features/storage/storage'
import type { BoardNode } from '../features/board/boardTypes'
import type { AIRequest, AIContext } from '../features/ai/aiTypes'
// 🦸‍♂️ PHASE 2 IMPORTS - Superman's Advanced Intelligence
import { actionDetectionEngine } from '../features/ai/actionDetection'
import { multiStepOrchestrator } from '../features/ai/multiStepActions'
import type { DetectedAction, ActionType } from '../features/ai/actionDetection'
import type { ExecutionProgress, ExecutionReport } from '../features/ai/multiStepActions'
import { useBoardStore } from '../features/board/boardSlice'
import { searchPlacesGoogle } from '../features/places/placesApi'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    nodeId?: string
    actionType?: string
    tokens?: number
    command?: string
    // 🦸‍♂️ Phase 2 metadata
    actionsExecuted?: number
    detectedActions?: DetectedAction[]
    executionReport?: ExecutionReport
    processingTime?: number
  }
}

interface ChatContext {
  boardNodes: BoardNode[]
  selectedNode: BoardNode | null
  boardName?: string
  documentCount: number
  nodeCount: number
  connectionCount: number
  focusedNodes: string[]
  extractedTexts: Record<string, string>
  topic?: string
}

interface ChatCommand {
  name: string
  description: string
  aliases: string[]
  execute: (args: string[], context: ChatContext) => Promise<string>
}

interface UseChatOptions {
  autoSave?: boolean
  maxHistory?: number
  enableCommands?: boolean
}

interface UseChatResult {
  messages: ChatMessage[]
  sendMessage: (message: string) => Promise<void>
  clearMessages: () => void
  isLoading: boolean
  error: string | null
  context: ChatContext
  availableCommands: ChatCommand[]
  executeCommand: (command: string, args: string[]) => Promise<string>
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const { autoSave = true, maxHistory = 100, enableCommands = true } = options
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: '🦸‍♂️ **Superman AI Assistant** activated! I can see everything, do everything, and help you build amazing knowledge graphs!\n\n**Try these commands:**\n- `/analyze` - Analyze your board\n- `/create [idea]` - Create nodes\n- `/help` - Show all commands\n- Just chat naturally - I understand context!',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // --- Intent tracking ---
  const [pendingIntent, setPendingIntent] = useState<null | { type: string; query?: string }>(null)

  const { nodes, edges, selectedNode, selectedNodeId, addNode } = useBoard()
  const { generateNode } = useAINodeGenerator()
  const { summarizeBoard, generateBoardExtensions } = useBoardAI()
  const { generate } = useAI()
  const { getViewportCenter } = useViewportCenter()
  const { selectOptimalModel, isInitialized } = useAIContext()
  const { topic } = useBoardStore()

  // Build comprehensive context
  const context: ChatContext = {
    boardNodes: nodes,
    selectedNode: selectedNode || null,
    boardName: 'Current Board', // TODO: Get actual board name
    documentCount: nodes.filter(n => n.type === 'document').length,
    nodeCount: nodes.length,
    connectionCount: edges.length,
    focusedNodes: selectedNodeId ? [selectedNodeId] : [],
    extractedTexts: nodes.reduce((acc, node) => {
      if (node.type === 'document' && node.data.extractedText) {
        acc[node.id] = node.data.extractedText
      }
      return acc
    }, {} as Record<string, string>),
    topic: topic || undefined,
  }

  // Superman Commands with god-mode powers
  const commands: ChatCommand[] = [
    {
      name: 'analyze',
      description: 'Analyze the current board and provide insights',
      aliases: ['analysis', 'insights'],
      execute: async (args, context) => {
        const analysis = await summarizeBoard()
        return `🧠 **Board Analysis:**\n\n${analysis}\n\n**Stats:**\n- ${context.nodeCount} nodes\n- ${context.connectionCount} connections\n- ${context.documentCount} documents`
      }
    },
    {
      name: 'create',
      description: 'Create new nodes from your description',
      aliases: ['node', 'add', 'generate'],
      execute: async (args, context) => {
        const description = args.join(' ')
        if (!description) return '❌ Please provide a description for the node to create'
        
        try {
          const result = await generateNode(description)
          return `✅ **Node Created!** Generated new node: "${result}"\n\nThe node has been added to your board with AI-generated content.`
        } catch (error) {
          return `❌ **Error creating node:** ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    },
    {
      name: 'expand',
      description: 'Generate multiple related nodes around a concept',
      aliases: ['cluster', 'related', 'branch'],
      execute: async (args, context) => {
        const count = parseInt(args[0]) || 3
        const concept = args.slice(1).join(' ')
        
        if (!concept) {
          return '❌ Please provide a concept to expand on'
        }
        
        try {
          const extensions = await generateBoardExtensions(count)
          return `🌟 **Expansion Complete!** Generated ${extensions.length} related concepts:\n\n${extensions.map(ext => `• ${ext}`).join('\n')}\n\nThese concepts complement your existing knowledge graph.`
        } catch (error) {
          return `❌ **Error generating extensions:** ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    },
    {
      name: 'search',
      description: 'Search through document contents',
      aliases: ['find', 'query', 'lookup'],
      execute: async (args, context) => {
        const query = args.join(' ').toLowerCase()
        if (!query) return '❌ Please provide a search query'
        
        const results: string[] = []
        
        // Search through extracted texts
        Object.entries(context.extractedTexts).forEach(([nodeId, text]) => {
          if (text.toLowerCase().includes(query)) {
            const node = context.boardNodes.find(n => n.id === nodeId)
            if (node) {
              const snippet = text.substring(
                Math.max(0, text.toLowerCase().indexOf(query) - 50),
                text.toLowerCase().indexOf(query) + query.length + 50
              )
              results.push(`📄 **${node.data.label}:** ...${snippet}...`)
            }
          }
        })
        
        // Search through node labels and content
        context.boardNodes.forEach(node => {
          if (node.data.label.toLowerCase().includes(query) || 
              node.data.content?.toLowerCase().includes(query)) {
            results.push(`🔍 **${node.data.label}:** ${node.data.content || 'No content'}`)
          }
        })
        
        if (results.length === 0) {
          return `❌ No results found for "${query}"`
        }
        
        return `🔍 **Search Results for "${query}":**\n\n${results.slice(0, 5).join('\n\n')}\n\n${results.length > 5 ? `...and ${results.length - 5} more results` : ''}`
      }
    },
    {
      name: 'focus',
      description: 'Focus on specific nodes or documents',
      aliases: ['select', 'highlight'],
      execute: async (args, context) => {
        const target = args.join(' ').toLowerCase()
        if (!target) return '❌ Please specify what to focus on'
        
        const matchingNodes = context.boardNodes.filter(node => 
          node.data.label.toLowerCase().includes(target)
        )
        
        if (matchingNodes.length === 0) {
          return `❌ No nodes found matching "${target}"`
        }
        
        return `🎯 **Found ${matchingNodes.length} matching nodes:**\n\n${matchingNodes.map(node => 
          `• ${node.data.label} (${node.type})`
        ).join('\n')}`
      }
    },
    {
      name: 'docs',
      description: 'List and analyze uploaded documents',
      aliases: ['documents', 'files', 'uploads'],
      execute: async (args, context) => {
        const docNodes = context.boardNodes.filter(n => n.type === 'document')
        
        if (docNodes.length === 0) {
          return '📄 No documents uploaded yet. Drag and drop files onto the board to get started!'
        }
        
        const docList = docNodes.map(node => {
          const size = node.data.fileSize ? `${Math.round(node.data.fileSize / 1024)}KB` : 'Unknown'
          const extractedLength = node.data.extractedText?.length || 0
          return `📄 **${node.data.label}**\n   Type: ${node.data.fileType || 'Unknown'}\n   Size: ${size}\n   Extracted: ${extractedLength} characters`
        }).join('\n\n')
        
        return `📚 **Document Library (${docNodes.length} documents):**\n\n${docList}`
      }
    },
    {
      name: 'help',
      description: 'Show available commands and usage',
      aliases: ['commands', '?'],
      execute: async (args, context) => {
        const commandList = commands.map(cmd => 
          `**/${cmd.name}** - ${cmd.description}\n   Aliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}`
        ).join('\n\n')
        
        return `��‍♂️ **Superman AI Commands:**\n\n${commandList}\n\n**Context Info:**\n- ${context.nodeCount} nodes on board\n- ${context.documentCount} documents loaded\n- ${context.connectionCount} connections\n\n**Tips:**\n- Use natural language - I understand context!\n- Commands can be combined with questions\n- I can see everything on your board`
      }
    },
    {
      name: 'stats',
      description: 'Show detailed board statistics',
      aliases: ['info', 'status'],
      execute: async (args, context) => {
        const nodeTypes = context.boardNodes.reduce((acc, node) => {
          const nodeType = node.type || 'default'
          acc[nodeType] = (acc[nodeType] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const aiGeneratedCount = context.boardNodes.filter(n => n.data.aiGenerated).length
        const totalContent = context.boardNodes.reduce((acc, node) => 
          acc + (node.data.content?.length || 0), 0
        )
        
        return `📊 **Board Statistics:**\n\n**Nodes:** ${context.nodeCount}\n${Object.entries(nodeTypes).map(([type, count]) => 
          `  • ${type}: ${count}`
        ).join('\n')}\n\n**Content:** ${totalContent.toLocaleString()} characters\n**AI Generated:** ${aiGeneratedCount} nodes\n**Documents:** ${context.documentCount}\n**Connections:** ${context.connectionCount}\n\n**Board:** ${context.boardName}`
      }
    }
  ]

  // Execute commands
  const executeCommand = useCallback(async (command: string, args: string[]): Promise<string> => {
    const cmd = commands.find(c => 
      c.name === command || c.aliases.includes(command)
    )
    
    if (!cmd) {
      return `❌ Unknown command: /${command}\n\nType \`/help\` to see available commands.`
    }
    
    try {
      return await cmd.execute(args, context)
    } catch (error) {
      return `❌ Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }, [context, commands])

  // Conversation buffer: last 10 messages
  const conversationBuffer = messages.slice(-10)

  // When sending a message, check for pending intent
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return
    
    // Check if AI service is initialized
    if (!isInitialized) {
      setError('AI service not initialized. Please configure your OpenAI API key first.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    // If there is a pending intent (e.g., waiting for location)
    if (pendingIntent) {
      if (pendingIntent.type === 'find_places') {
        // Fulfill the intent: use the last query and this message as location
        const results = await searchPlacesGoogle(pendingIntent.query || 'plant nursery', message)
        setMessages(prev => [
          ...prev,
          {
            id: `intent-fulfilled-${Date.now()}`,
            role: 'system',
            content: `Here are some results for ${pendingIntent.query} in ${message}:\n` + results.map(r => `• **${r.name}**\n${r.address}\n[View on Google Maps](${r.url})`).join('\n\n'),
            timestamp: new Date()
          }
        ])
        setPendingIntent(null)
        setIsLoading(false)
        return
      }
    }
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    
    // Pass conversation buffer as part of AI context
    const aiContext = {
      ...context,
      conversation: {
        messages: conversationBuffer,
        sessionId: 'current',
        startedAt: messages[0]?.timestamp || new Date()
      }
    }
    try {
      // Call the AI with the conversation buffer in context
      const response = await generate(message, { context: aiContext })
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      // If AI asks for location, set pendingIntent
      if (/please provide (your )?(city|location|area)/i.test(response.content)) {
        setPendingIntent({ type: 'find_places', query: message })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response')
    } finally {
      setIsLoading(false)
    }
  }, [context, enableCommands, executeCommand, generate, selectOptimalModel, autoSave, isInitialized, pendingIntent, conversationBuffer])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Limit message history
  useEffect(() => {
    if (messages.length > maxHistory) {
      setMessages(prev => prev.slice(-maxHistory))
    }
  }, [messages, maxHistory])

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading,
    error,
    context,
    availableCommands: commands,
    executeCommand
  }
} 
