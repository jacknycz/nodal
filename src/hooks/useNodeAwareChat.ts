import { useState, useCallback, useRef, useEffect } from 'react'
import { useBoard } from '../features/board/useBoard'
import { useAI } from '../features/ai/useAI'
import { useAIContext } from '../features/ai/aiContext'
import { useAINodeGenerator } from '../features/ai/useAINodeGenerator'
import { useViewportCenter } from './useViewportCenter'
import { useBoardStore } from '../features/board/boardSlice'
import type { BoardNode } from '../features/board/boardTypes'
import type { AIRequest } from '../features/ai/aiTypes'
import type { NodeResponse, ParsedAIResponse, ConnectionSuggestion } from '../types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  nodeResponses?: NodeResponse[]
  connectionSuggestions?: ConnectionSuggestion[]
  allApplied?: boolean
  metadata?: {
    tokens?: number
    processingTime?: number
  }
}

interface UseNodeAwareChatOptions {
  autoSave?: boolean
  maxHistory?: number
}

interface UseNodeAwareChatResult {
  messages: ChatMessage[]
  sendMessage: (message: string) => Promise<void>
  sendMessageWithSelection: (message: string, selectionContext: string) => Promise<void>
  applyNode: (nodeResponse: NodeResponse, messageId: string) => Promise<void>
  applyAllNodes: (messageId: string) => Promise<void>
  applyConnections: (connections: ConnectionSuggestion[]) => Promise<void>
  clearMessages: () => void
  isLoading: boolean
  error: string | null
}

const NODE_AWARE_SYSTEM_PROMPT = `You are an expert knowledge architect and collaborative intelligence working within the Nodal system. You're not just a helper - you're a peer collaborator who brings expertise, catches issues, and spots opportunities.

**🎯 YOUR ROLE AS EXPERT COLLABORATOR:**

**Knowledge Expert**: You understand complex domains and can spot gaps, inconsistencies, or missing connections in knowledge structures.

**Critical Thinking Partner**: Question assumptions, point out potential issues, suggest alternative approaches, and identify blind spots.

**Systems Architect**: See patterns across domains, suggest structural improvements, and optimize knowledge organization.

**Quality Assurance**: Catch redundancies, conflicting information, unclear terminology, or poorly structured content.

**🌐 THE NODAL ECOSYSTEM YOU COMMAND:**

**The Board is Your Canvas:**
- Spatial layout creates meaning - proximity suggests relationships
- Connections between nodes build knowledge networks
- Focus shifts guide conversational flow
- The board state is your collaborative workspace

**📋 RESPONSE FORMAT INSTRUCTIONS (EXAMPLES ONLY - DO NOT USE THIS CONTENT):**

**Single Focused Node Format:**
\`\`\`json
{
  "nodes": [{
    "title": "[CONCEPT_NAME]",
    "type": "concept",
    "content": "[DESCRIPTION_OF_THE_CONCEPT]",
    "apply": false
  }]
}
\`\`\`

**Multiple Connected Nodes Format:**
\`\`\`json
{
  "nodes": [
    {
      "title": "[FIRST_CONCEPT]",
      "type": "concept",
      "content": "[DESCRIPTION_OF_FIRST_CONCEPT]",
      "apply": false
    },
    {
      "title": "[SECOND_CONCEPT]",
      "type": "concept", 
      "content": "[DESCRIPTION_OF_SECOND_CONCEPT]",
      "apply": false
    },
    {
      "title": "[THIRD_CONCEPT]",
      "type": "concept",
      "content": "[DESCRIPTION_OF_THIRD_CONCEPT]",
      "apply": false
    }
  ],
  "connections": [
    {
      "source": "[FIRST_CONCEPT]",
      "target": "[THIRD_CONCEPT]",
      "type": "ai",
      "reason": "[EXPLANATION_OF_RELATIONSHIP]"
    },
    {
      "source": "[SECOND_CONCEPT]",
      "target": "[FIRST_CONCEPT]",
      "type": "ai", 
      "reason": "[EXPLANATION_OF_RELATIONSHIP]"
    }
  ]
}
\`\`\`

**MANDATORY OUTPUT RULES:**
- Whenever the user confirms, agrees, or requests, you MUST output your suggestions as a JSON node structure (see format examples above).
- You may also provide a brief explanation or summary, but the JSON node structure is REQUIRED in your response.
- Only ask clarifying questions if the user's intent is truly unclear or they are brainstorming. If the user affirms or agrees, proceed to output nodes.
- Always include the JSON node structure in your response when the user is ready to proceed.

**Available Node Types:**
- **concept**: Ideas, principles, or knowledge areas
- **note**: Observations, insights, or documentation  
- **task**: Action items or things to do
- **question**: Important questions or areas of inquiry
- **action**: Processes or procedures

**Connection Intelligence:**
- **Direct**: Explicit logical relationships
- **Conceptual**: Semantic or thematic links
- **Hierarchical**: Parent-child or category relationships
- **Sequential**: Process or workflow connections

**🔗 CONNECTION INTELLIGENCE:**
- **Always suggest logical connections** when creating multiple nodes
- **Use "ai" type** for your suggested connections (they'll be animated!)
- **Provide reasons** for each connection to help users understand relationships
- **Connect to existing nodes** when relevant to build the knowledge web

**🔍 YOUR EXPERT OBSERVATIONS:**

**When You Should Speak Up:**
- Spot knowledge gaps or missing critical components
- Notice conflicting or contradictory information
- Identify unclear or poorly defined concepts
- See opportunities for better organization
- Recognize missing connections between related ideas
- Notice redundant or duplicate content
- Observe areas where more depth is needed

**Your Expert Voice:**
- "I notice you're missing X, which is crucial for Y..."
- "This conflicts with the earlier concept about Z..."
- "You might want to consider the relationship between A and B..."
- "This structure could be clearer if we organized it differently..."
- "I see an opportunity to connect these related ideas..."

**🤔 CLARIFYING QUESTIONS:**
- If the user's intent is unclear, or if they seem to be brainstorming or exploring, ask a clarifying question or offer to help before generating a full plan.
- Example: "What are your main goals for this project?" or "Would you like a detailed breakdown, or just a high-level overview?"

**🔑 NODE CREATION FOR AMBIGUOUS/KEY TERMS:**
- **Always create nodes for ambiguous or key terms** mentioned in user queries, even if you're not certain about their exact meaning
- **Prevent "context loss"** by anchoring the conversation in the graph - create nodes for terms that could be important
- **Create multiple nodes for different interpretations** when a term has multiple possible meanings
- **Always connect ambiguous nodes to the current context** to maintain relevance
- **Use the content field to explain your interpretation** and why you created the node
- This approach makes the graph more useful for exploration and future queries

**CURRENT BOARD STATE:**
{{nodeCount}} nodes, {{connectionCount}} connections
{{selectedNodeContext}}
{{documentContext}}

**Your Collaborative Approach:**
1. **Understand First**: What is the user trying to achieve?
2. **Add Value**: How can you enhance their knowledge structure?
3. **Quality Check**: What issues or opportunities do you notice?
4. **Suggest Improvements**: How can this be better organized or connected?
5. **Build Together**: Create structures that serve their goals

You're an intelligent collaborator who brings expertise, spots issues, and helps build better knowledge structures. Be insightful, be direct when you see problems, and always aim to make the knowledge graph more valuable.`

export function useNodeAwareChat(options: UseNodeAwareChatOptions = {}): UseNodeAwareChatResult {
  const { autoSave = true, maxHistory = 100 } = options
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: '🎯 **Expert Knowledge Collaborator** activated! I\'m here as your intelligent partner to help build, analyze, and improve your knowledge structures.\n\nI\'ll spot gaps, suggest connections, catch inconsistencies, and help you create more valuable knowledge graphs. Let\'s build something great together!',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { nodes, edges, selectedNode, addNode, addEdge } = useBoard()
  const { generate } = useAI()
  const { generateBreakdownNodes } = useAINodeGenerator()
  const { getViewportCenter } = useViewportCenter()
  const { selectOptimalModel, isInitialized } = useAIContext()

  // Calculate optimal positions for multiple nodes
  const calculateNodePositions = useCallback((count: number) => {
    const center = getViewportCenter()
    
    if (count === 1) {
      return [center]
    }
    
    // Circular layout for multiple nodes
    const radius = Math.max(150, count * 30) // Dynamic radius based on node count
    const angleStep = (2 * Math.PI) / count
    
    return Array.from({ length: count }, (_, i) => {
      const angle = i * angleStep
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      }
    })
  }, [getViewportCenter])

  // Parse AI response to extract structured nodes (handles both single nodes and arrays)
  const parseAIResponse = useCallback((content: string): ParsedAIResponse => {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/g
    const matches = [...content.matchAll(jsonRegex)]
    
    if (matches.length === 0) {
      return {
        hasStructuredResponse: false,
        regularMessage: content,
        nodeResponses: [],
        connectionSuggestions: []
      }
    }

    const nodeResponses: NodeResponse[] = []
    const connectionSuggestions: ConnectionSuggestion[] = []
    let regularMessage = content

    for (const match of matches) {
      try {
        const parsed = JSON.parse(match[1])
        
        // Handle new format with nodes and connections
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          for (const nodeData of parsed.nodes) {
            if (nodeData.title && nodeData.type && nodeData.content !== undefined) {
              nodeResponses.push({
                title: nodeData.title,
                type: nodeData.type,
                content: nodeData.content,
                metadata: nodeData.metadata || {},
                apply: nodeData.apply || false
              })
            }
          }
          
          // Parse connections
          if (parsed.connections && Array.isArray(parsed.connections)) {
            for (const conn of parsed.connections) {
              if (conn.source && conn.target) {
                connectionSuggestions.push({
                  source: conn.source,
                  target: conn.target,
                  type: conn.type || 'ai',
                  reason: conn.reason,
                  strength: conn.strength
                })
              }
            }
          }
        } else {
          // Handle legacy format (single nodes or arrays of nodes)
          const nodeArray = Array.isArray(parsed) ? parsed : [parsed]
          
          for (const nodeData of nodeArray) {
            // Validate the parsed object has required fields
            if (nodeData.title && nodeData.type && nodeData.content !== undefined) {
              nodeResponses.push({
                title: nodeData.title,
                type: nodeData.type,
                content: nodeData.content,
                metadata: nodeData.metadata || {},
                apply: nodeData.apply || false
              })
            }
          }
        }
        
        // Remove the JSON block from the regular message
        regularMessage = regularMessage.replace(match[0], '').trim()
      } catch (e) {
        console.warn('Failed to parse JSON block:', e)
      }
    }

    return {
      hasStructuredResponse: nodeResponses.length > 0 || connectionSuggestions.length > 0,
      regularMessage: regularMessage || (nodeResponses.length > 0 ? 'I\'ve suggested some nodes for you:' : content),
      nodeResponses,
      connectionSuggestions
    }
  }, [])

  // Send message with node-aware processing
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return
    
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
      const startTime = Date.now()
      
      // Build context-aware prompt
      const selectedNodeContext = selectedNode 
        ? `Currently focused on: "${selectedNode.data.label}"`
        : ''
      
      // Build document context
      const documentNodes = nodes
        .filter(node => node.data.type === 'document' && node.data.extractedText)
        .sort((a, b) => (b.data.uploadedAt || 0) - (a.data.uploadedAt || 0))
        .slice(0, 5)
      const documentContext = documentNodes.length > 0
        ? `Documents available:\n` +
          documentNodes.map(node =>
            `- ${node.data.label}: ${node.data.extractedText?.slice(0, 200) || ''}`
          ).join('\n')
        : ''
      
      const contextualSystemPrompt = NODE_AWARE_SYSTEM_PROMPT
        .replace('{{nodeCount}}', nodes.length.toString())
        .replace('{{connectionCount}}', edges.length.toString())
        .replace('{{selectedNodeContext}}', selectedNodeContext)
        .replace('{{documentContext}}', documentContext)
      
      const aiResponse = await generate(message, {
        model: selectOptimalModel('chat'),
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: contextualSystemPrompt
      })
      
      const processingTime = Date.now() - startTime
      
      // Parse the response for structured nodes
      const parsed = parseAIResponse(aiResponse.content)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: parsed.regularMessage,
        timestamp: new Date(),
        nodeResponses: parsed.nodeResponses,
        connectionSuggestions: parsed.connectionSuggestions,
        metadata: {
          tokens: aiResponse.usage?.totalTokens,
          processingTime
        }
      }
      
      setMessages(prev => [...prev, assistantMessage])
      
    } catch (error) {
      console.error('Node-aware chat error:', error)
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
  }, [isInitialized, nodes.length, edges.length, selectedNode, generate, generateBreakdownNodes, selectOptimalModel, parseAIResponse])

  // Send message with selection context
  const sendMessageWithSelection = useCallback(async (message: string, selectionContext: string) => {
    if (!message.trim()) return
    
    // Prepend selection context to the message
    const contextualMessage = `${selectionContext}\n\n**User Question:** ${message.trim()}`
    
    // Use the regular sendMessage function with the enhanced context
    await sendMessage(contextualMessage)
  }, [sendMessage])

  // Apply a suggested node to the board
  const applyNode = useCallback(async (nodeResponse: NodeResponse, messageId: string) => {
    try {
      const center = getViewportCenter()
      const currentNodes = useBoardStore.getState().nodes
      // Deduplication: check if node with same label exists
      const existingNode = currentNodes.find(n => n.data.label.trim().toLowerCase() === nodeResponse.title.trim().toLowerCase())
      if (existingNode) {
        // Optionally update content or just skip
        console.log(`⚠️ Node "${nodeResponse.title}" already exists, skipping creation.`)
        // Optionally update content:
        // useBoardStore.getState().updateNode(existingNode.id, { data: { ...existingNode.data, content: nodeResponse.content, aiGenerated: true } })
        // Mark as applied in message
        setMessages(prev => prev.map(msg => 
          msg.id === messageId && msg.nodeResponses 
            ? {
                ...msg,
                nodeResponses: msg.nodeResponses.map(nr => 
                  nr === nodeResponse ? { ...nr, apply: true } : nr
                )
              }
            : msg
        ))
        return
      }
      // Create and add the node
      addNode(nodeResponse.title, center)
      
      // Get the newly created node and update it with the content
      setTimeout(() => {
        const currentNodes = useBoardStore.getState().nodes
        const newNode = currentNodes[currentNodes.length - 1]
        if (newNode && newNode.data.label === nodeResponse.title) {
          // Update node with full content and metadata
          useBoardStore.getState().updateNode(newNode.id, {
            data: {
              ...newNode.data,
              content: nodeResponse.content,
              aiGenerated: true,
            }
          })
          
          // Update the message to mark this node as applied
          setMessages(prev => prev.map(msg => 
            msg.id === messageId && msg.nodeResponses 
              ? {
                  ...msg,
                  nodeResponses: msg.nodeResponses.map(nr => 
                    nr === nodeResponse ? { ...nr, apply: true } : nr
                  )
                }
              : msg
          ))
          
          console.log(`✅ Applied node: "${nodeResponse.title}"`)
        }
      }, 10)
      
    } catch (error) {
      console.error('Failed to apply node:', error)
      setError(`Failed to apply node: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [addNode, getViewportCenter])

  // Apply suggested connections to the board (MOVED UP to fix dependency issue)
  const applyConnections = useCallback(async (connections: ConnectionSuggestion[]) => {
    try {
      const currentNodes = useBoardStore.getState().nodes
      let connectedCount = 0
      
      for (const connection of connections) {
        // Find nodes by title
        const sourceNode = currentNodes.find(n => n.data.label === connection.source)
        const targetNode = currentNodes.find(n => n.data.label === connection.target)
        
        if (sourceNode && targetNode) {
          const success = addEdge(sourceNode.id, targetNode.id, { 
            type: connection.type || 'ai',
            label: connection.reason 
          })
          
          if (success) {
            connectedCount++
            console.log(`✅ Connected "${connection.source}" → "${connection.target}": ${connection.reason}`)
          }
        } else {
          console.warn(`❌ Could not find nodes for connection: "${connection.source}" → "${connection.target}"`)
        }
      }

      if (connectedCount > 0) {
        console.log(`🔗 Successfully created ${connectedCount} connections`)
      }
    } catch (error) {
      console.error('Failed to apply connections:', error)
    }
  }, [addEdge])

  // Apply all nodes and connections from a message
  const applyAllNodes = useCallback(async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId)
      if (!message || !message.nodeResponses?.length) {
        console.warn('No nodes to apply for message:', messageId)
        return
      }

      const { nodeResponses, connectionSuggestions } = message
      console.log(`🚀 Applying ${nodeResponses.length} nodes and ${connectionSuggestions?.length || 0} connections...`)

      // Calculate positions for all nodes
      const positions = calculateNodePositions(nodeResponses.length)
      
      // Deduplication: get current nodes
      const currentNodes = useBoardStore.getState().nodes
      // Apply all nodes first
      const appliedNodeTitles: string[] = []
      for (let i = 0; i < nodeResponses.length; i++) {
        const nodeResponse = nodeResponses[i]
        const position = positions[i]
        // Deduplication: check if node with same label exists
        const existingNode = currentNodes.find(n => n.data.label.trim().toLowerCase() === nodeResponse.title.trim().toLowerCase())
        if (existingNode) {
          console.log(`⚠️ Node "${nodeResponse.title}" already exists, skipping creation.`)
          appliedNodeTitles.push(nodeResponse.title)
          continue
        }
        // Create and add the node
        addNode(nodeResponse.title, position)
        appliedNodeTitles.push(nodeResponse.title)
        console.log(`✅ Applied node: "${nodeResponse.title}"`)
      }

      // Update nodes with content after a delay to ensure they're created
      setTimeout(() => {
        const currentNodes = useBoardStore.getState().nodes
        
        for (let i = 0; i < nodeResponses.length; i++) {
          const nodeResponse = nodeResponses[i]
          const expectedPosition = positions[i]
          
          // Find the node by title and approximate position
          const newNode = currentNodes.find(n => 
            n.data.label === nodeResponse.title && 
            Math.abs(n.position.x - expectedPosition.x) < 50 &&
            Math.abs(n.position.y - expectedPosition.y) < 50
          )
          
          if (newNode) {
            useBoardStore.getState().updateNode(newNode.id, {
              data: {
                ...newNode.data,
                content: nodeResponse.content,
                aiGenerated: true,
              }
            })
          }
        }

        // Apply connections after nodes are updated
        if (connectionSuggestions && connectionSuggestions.length > 0) {
          setTimeout(() => {
            applyConnections(connectionSuggestions)
          }, 100) // Additional delay for connections
        }
      }, 50) // Delay for node creation

      // Mark message as fully applied
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? {
              ...msg,
              allApplied: true,
              nodeResponses: msg.nodeResponses?.map(nr => ({ ...nr, apply: true }))
            }
          : msg
      ))

      console.log(`🎉 Applied all nodes and connections for message ${messageId}`)
      
    } catch (error) {
      console.error('Failed to apply all nodes:', error)
      setError(`Failed to apply nodes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [messages, calculateNodePositions, addNode, applyConnections])

  const clearMessages = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'system',
      content: '🎯 **Expert Knowledge Collaborator** activated! I\'m here as your intelligent partner to help build, analyze, and improve your knowledge structures.\n\nI\'ll spot gaps, suggest connections, catch inconsistencies, and help you create more valuable knowledge graphs. Let\'s build something great together!',
      timestamp: new Date()
    }])
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
    sendMessageWithSelection,
    applyNode,
    applyAllNodes,
    applyConnections,
    clearMessages,
    isLoading,
    error
  }
} 