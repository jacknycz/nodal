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

  // Parse and handle messages
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return
    
    // Check if AI service is initialized
    if (!isInitialized) {
      setError('AI service not initialized. Please configure your OpenAI API key first.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    try {
      let response: string
      
      // Check if it's a command
      if (message.startsWith('/') && enableCommands) {
        const parts = message.slice(1).split(' ')
        const command = parts[0].toLowerCase()
        const args = parts.slice(1)
        
        response = await executeCommand(command, args)
        
        const commandMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            command: command,
            actionType: 'command'
          }
        }
        
        setMessages(prev => [...prev, commandMessage])
      } else {
        // 🦸‍♂️ PHASE 2: ADVANCED ACTION DETECTION & ORCHESTRATION
        const phaseStartTime = Date.now()
        
        // 1. Build comprehensive AI context
        const aiContext: AIContext = {
          board: {
            nodes: context.boardNodes,
            edges: edges,
            selectedNodeId: context.selectedNode?.id || null,
            focusedNodeIds: context.focusedNodes,
            boardSummary: `Board with ${context.nodeCount} nodes and ${context.connectionCount} connections`
          },
          documents: context.documentCount > 0 ? {
            documents: Object.entries(context.extractedTexts).map(([nodeId, text]) => ({
              id: nodeId,
              name: context.boardNodes.find(n => n.id === nodeId)?.data.label || 'Unknown',
              type: 'document',
              content: text,
              uploadedAt: new Date(),
              nodeIds: [nodeId]
            }))
          } : undefined,
          conversation: {
            messages: messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              metadata: msg.metadata
            })),
            sessionId: 'current',
            startedAt: new Date()
          }
        }
        
        // 2. Detect actions using Phase 2 engine
        const detectedActions = await actionDetectionEngine.detectActions(message, aiContext)
        
        // 3. Check if complex actions were detected
        if (detectedActions.length > 0 && detectedActions[0].confidence > 0.5) {
          // Phase 2 execution path - use Multi-Step Orchestrator
          let executionReport: ExecutionReport | null = null
          let progressUpdates: string[] = []
          
          try {
            // Execute actions using orchestrator
            executionReport = await multiStepOrchestrator.executeActions(
              detectedActions,
              aiContext,
              (progress: ExecutionProgress) => {
                progressUpdates.push(`⚡ ${progress.completedActions}/${progress.totalSteps} actions completed`)
              }
            )
            
            // Generate enhanced response
            const actionSummary = detectedActions.map(action => 
              `🎯 **${action.type.replace('_', ' ').toUpperCase()}** (${Math.round(action.confidence * 100)}% confidence)`
            ).join('\n')
            
            const executionSummary = `🚀 **Execution Complete!**\n` +
              `• ${executionReport.summary.completedActions}/${executionReport.summary.totalActions} actions successful\n` +
              `• ${executionReport.summary.totalTime}ms total execution time\n` +
              `• ${Math.round(executionReport.performance.successRate * 100)}% success rate`
            
            const finalResponse = `🦸‍♂️ **Superman Phase 2 Activated!**\n\n` +
              `**Actions Detected:**\n${actionSummary}\n\n` +
              `**Execution Results:**\n${executionSummary}\n\n` +
              `${progressUpdates.join('\n')}\n\n` +
              `**Created:** ${executionReport.results.flatMap(r => r.metadata?.nodesCreated || []).length} nodes\n` +
              `**Performance:** ${executionReport.performance.parallelEfficiency > 0.8 ? '🔥 Excellent' : '⚡ Good'} parallel efficiency`
            
            const assistantMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: finalResponse,
              timestamp: new Date(),
              metadata: {
                actionType: 'phase2_execution',
                tokens: 0,
                actionsExecuted: detectedActions.length,
                detectedActions: detectedActions,
                executionReport: executionReport,
                processingTime: Date.now() - phaseStartTime
              }
            }
            
            setMessages(prev => [...prev, assistantMessage])
            
          } catch (error) {
            console.error('Phase 2 execution error:', error)
            
            // Fallback to Phase 1 if Phase 2 fails
            const fallbackResponse = `🦸‍♂️ **Superman Phase 2 encountered an issue, falling back to Phase 1...**\n\n` +
              `**Detected Actions:** ${detectedActions.length}\n` +
              `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
              `Let me handle this the traditional way...`
            
            const errorMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: fallbackResponse,
              timestamp: new Date(),
              metadata: {
                actionType: 'phase2_fallback',
                actionsExecuted: 0,
                detectedActions: detectedActions,
                processingTime: Date.now() - phaseStartTime
              }
            }
            
            setMessages(prev => [...prev, errorMessage])
            
            // Execute Phase 1 fallback
            await executePhase1Fallback(message, aiContext)
          }
          
        } else {
          // Phase 1 execution path - traditional AI response with simple commands
          await executePhase1Fallback(message, aiContext)
        }
        
        // Phase 1 fallback function
        async function executePhase1Fallback(message: string, aiContext: AIContext) {
          const contextPrompt = `You are Superman AI, an advanced assistant helping users build knowledge graphs. You have full access to their board and documents.

**Current Board Context:**
- ${context.nodeCount} nodes, ${context.connectionCount} connections
- ${context.documentCount} documents uploaded
- Selected node: ${context.selectedNode ? `"${context.selectedNode.data.label}"` : 'None'}

**Available Nodes:**
${context.boardNodes.slice(0, 10).map(node => 
  `- ${node.data.label} (${node.type}): ${node.data.content ? node.data.content.substring(0, 100) + '...' : 'No content'}`
).join('\n')}

**Documents:**
${Object.keys(context.extractedTexts).length > 0 ? 
  Object.entries(context.extractedTexts).slice(0, 3).map(([nodeId, text]) => {
    const node = context.boardNodes.find(n => n.id === nodeId)
    return `- ${node?.data.label}: ${text.substring(0, 200)}...`
  }).join('\n') : 'No documents with extracted text'}

**🦸‍♂️ SUPERMAN POWERS - TAKE ACTION!**
When users ask you to create nodes or take actions, you MUST include the appropriate command in your response to actually DO it:

**Available Commands:**
- /create [description] - Actually creates nodes on the board
- /analyze - Analyzes the current board
- /expand [concept] - Creates multiple related nodes
- /search [query] - Searches through content
- /stats - Shows board statistics

**Response Format:**
- First explain what you're doing
- Then include the command to execute the action
- Example: "I'll create a marketing node for you. /create Marketing Ideas for Nodal"
- Commands will be automatically executed and results shown

**Be a DOER, not just a talker!** When users want nodes created, actually create them.

User message: ${message}`

          const aiResponse = await generate(contextPrompt, {
            model: selectOptimalModel('chat'),
            temperature: 0.7,
            maxTokens: 800,
            systemPrompt: 'You are Superman AI. When users ask you to create nodes or take actions, you MUST include the appropriate command in your response (like "/create [description]"). You have the power to both respond naturally AND execute real actions on the board. Be a DOER, not just a talker!'
          })
          
          // Check if the AI response contains commands and execute them
          let finalResponse = aiResponse.content
          const commandRegex = /\/(\w+)\s+([^\n]*)/g
          const commandMatches = [...finalResponse.matchAll(commandRegex)]
          
          if (commandMatches.length > 0) {
            let actionResults = []
            
            for (const match of commandMatches) {
              const [fullMatch, command, args] = match
              const argArray = args.trim().split(' ').filter(arg => arg.length > 0)
              
              try {
                const result = await executeCommand(command.toLowerCase(), argArray)
                actionResults.push({
                  command: fullMatch,
                  result: result
                })
              } catch (error) {
                actionResults.push({
                  command: fullMatch,
                  result: `❌ Error executing ${command}: ${error instanceof Error ? error.message : 'Unknown error'}`
                })
              }
            }
            
            // Replace command mentions with action results
            let resultIndex = 0
            finalResponse = finalResponse.replace(commandRegex, (match) => {
              const { command, result } = actionResults[resultIndex] || { command: match, result: 'No result' }
              resultIndex++
              return `**[EXECUTED]** ${command}\n\n${result}`
            })
          }
          
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: finalResponse,
            timestamp: new Date(),
            metadata: {
              actionType: 'phase1_chat',
              tokens: aiResponse.usage?.totalTokens,
              actionsExecuted: commandMatches.length || 0,
              processingTime: Date.now() - phaseStartTime
            }
          }
          
          setMessages(prev => [...prev, assistantMessage])
        }
      }
      
      // Auto-save if enabled
      if (autoSave) {
        // TODO: Implement chat history saving
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `❌ **Error:** ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [context, enableCommands, executeCommand, generate, selectOptimalModel, autoSave, isInitialized])

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
