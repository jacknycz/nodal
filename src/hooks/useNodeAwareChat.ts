import { useState, useCallback, useEffect } from 'react'
import { useBoard } from '../features/board/useBoard'
import { useAI } from '../features/ai/useAI'
import { useAIContext } from '../features/ai/aiContext'
import { useAINodeGenerator } from '../features/ai/useAINodeGenerator'
import { useViewportCenter } from './useViewportCenter'
import { useBoardStore } from '../features/board/boardSlice'
import type { BoardNode, BoardEdge } from '../features/board/boardTypes'
import type { AIRequest as _AIRequest } from '../features/ai/aiTypes'
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
  freeChatMode?: boolean
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

const NODE_AWARE_SYSTEM_PROMPT = `You are **Nodal** — the board's intelligent collaborator, systems thinker, and knowledge sharer.

Nodal activated — your thinking partner, knowledge architect, and curious collaborator. Let's map it out together.

You're not just an assistant; you're a thinking partner who spots gaps, builds structures, and keeps ideas sharp — all while sharing relevant facts and insights to help the user learn and think deeper.

---

**🎯 YOUR ROLE AS COLLABORATOR:**

- **Knowledge Expert** — Notice gaps, inconsistencies, and missing links.
- **Critical Thinking Partner** — Question assumptions, offer alternatives, highlight blind spots.
- **Systems Architect** — Spot patterns, optimize structures, organize information.
- **Quality Checker** — Call out redundancies, conflicts, unclear terms, or weak connections.
- **Knowledge Sharer** — Occasionally offer relevant facts, insights, or learning resources that enrich understanding. Keep it brief, interesting, and connected to the current topic.

---

**🌐 HOW YOU WORK IN THE NODAL ECOSYSTEM:**

- The **Board** is your shared workspace.
- Proximity suggests meaning.
- Connections build understanding.
- Focused nodes guide the conversation.
- You collaborate in real time with the board's evolving structure.

---

**📋 WHEN YOU RESPOND:**

- Always include a **structured JSON block** for node suggestions when the user asks, confirms, or agrees.
- Add a short explanation if helpful — but the JSON is required.
- Only ask clarifying questions if the user's intent is unclear or they're brainstorming.
- Occasionally share a cool, on-topic fact or insight to help the user learn something new.
- **When Free Chat Mode is enabled, switch to open-ended conversation — brainstorm, reflect, and ideate without suggesting nodes unless explicitly asked.**

---

**✅ NODE & CONNECTION EXAMPLES:**

_Single Node:_
\`\`\`json
{
  "nodes": [{
    "title": "[CONCEPT]",
    "type": "concept",
    "content": "[DESCRIPTION]",
    "apply": false
  }]
}
\`\`\`

_Multiple Nodes with Connections:_
\`\`\`json
{
  "nodes": [
    { "title": "[FIRST]", "type": "concept", "content": "[DESCRIPTION]", "apply": false },
    { "title": "[SECOND]", "type": "concept", "content": "[DESCRIPTION]", "apply": false }
  ],
  "connections": [
    { "source": "[FIRST]", "target": "[SECOND]", "type": "ai", "reason": "[WHY]" }
  ]
}
\`\`\`

---

**🗂️ AVAILABLE NODE TYPES:**

- **concept** — Ideas or principles
- **note** — Observations or insights
- **task** — Action items
- **question** — Key questions
- **action** — Processes or workflows

---

**🔗 CONNECTION TYPES YOU SUGGEST:**

- **Direct** — Logical links
- **Conceptual** — Thematic links
- **Hierarchical** — Parent/child
- **Sequential** — Processes

_(Use "ai" as your connection type)_

---

**🔍 WHEN YOU SHOULD SPEAK UP:**

- Knowledge gaps
- Contradictions
- Undefined concepts
- Missed connections
- Redundancy
- Areas lacking depth

---

**🗣️ HOW YOU SOUND:**

- "I notice a gap between X and Y — want me to connect them?"
- "This seems to overlap with Z — should we clarify?"
- "We could group A and B for clarity."
- "Fun fact: [RELEVANT FACT]."

---

**🤔 CLARIFYING WHEN NEEDED:**

> "What's your goal with this?"
> "Do you want a breakdown or just key points?"

---

**🔑 FOR AMBIGUOUS OR KEY TERMS:**

- Create nodes even if unclear.
- Anchor them in the board's context.
- Offer multiple nodes if meanings vary.
- Explain your interpretation.

---

**📊 BOARD STATE CONTEXT:**

- **{{nodeCount}} nodes**, **{{connectionCount}} connections**
- {{selectedNodeContext}}
- {{documentContext}}

---

**🧩 YOUR COLLABORATION PROCESS:**

1. Understand their goal
2. Add meaningful structure
3. Check for gaps or issues
4. Suggest clear improvements
5. Build together — make it sharper
6. Share insights that make learning stick

---

You are **Nodal.**

Confident. Insightful. Curious. Always ready to make thinking visible — and learning deeper.`

// Utility to get root node id
function getRootNodeId(nodes: BoardNode[], edges: BoardEdge[]): string | null {
  if (nodes.length === 0) return null;
  const outgoingCounts: Record<string, number> = {};
  edges.forEach((e: BoardEdge) => {
    outgoingCounts[e.source] = (outgoingCounts[e.source] || 0) + 1;
  });
  let max = -1;
  let rootId = nodes[0].id;
  for (const node of nodes) {
    const count = outgoingCounts[node.id] || 0;
    if (count > max) {
      max = count;
      rootId = node.id;
    }
  }
  return rootId;
}

export function useNodeAwareChat(options: UseNodeAwareChatOptions = {}): UseNodeAwareChatResult {
  const { autoSave: _autoSave = true, maxHistory = 100, freeChatMode = false } = options
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: '**Hey!** I\'m Nodal — the board’s intelligent collaborator, systems thinker, and knowledge sharer',
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
        ? `Currently focused on: "${selectedNode.data.title || ''}"`
        : ''
      
      // Build document context
      const documentNodes = nodes
        .filter(node => node.data.type === 'document' && node.data.extractedText)
        .sort((a, b) => (b.data.uploadedAt || 0) - (a.data.uploadedAt || 0))
        .slice(0, 5)
      const documentContext = documentNodes.length > 0
        ? `Documents available:\n` +
          documentNodes.map(node =>
            `- ${node.data.title || ''}: ${node.data.extractedText?.slice(0, 200) || ''}`
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
      
      // If freeChatMode is enabled, suppress node suggestions unless user explicitly asks for nodes
      let filteredNodeResponses = parsed.nodeResponses;
      let filteredConnectionSuggestions = parsed.connectionSuggestions;
      if (freeChatMode) {
        const explicitNodeRequest = /\b(node|add to board|suggest node|create node|make node|add node|apply node|generate node|add concept|add idea|add task|add question|add action)\b/i.test(message);
        if (!explicitNodeRequest) {
          filteredNodeResponses = [];
          filteredConnectionSuggestions = [];
        }
      }
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: parsed.regularMessage,
        timestamp: new Date(),
        nodeResponses: filteredNodeResponses,
        connectionSuggestions: filteredConnectionSuggestions,
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
  }, [isInitialized, nodes.length, edges.length, selectedNode, generate, generateBreakdownNodes, selectOptimalModel, parseAIResponse, freeChatMode])

  // Send message with selection context
  const sendMessageWithSelection = useCallback(async (message: string, selectionContext: string) => {
    if (!message.trim()) return
    
    // Prepend selection context to the message
    const contextualMessage = `${selectionContext}\n\n**User Question:** ${message.trim()}`
    
    // Use the regular sendMessage function with the enhanced context
    await sendMessage(contextualMessage)
  }, [sendMessage])

  // Apply a suggested node to the board
  const applyNode = useCallback(async (nodeResponse: NodeResponse, messageId: string, referencedNodeTitles?: string[]) => {
    try {
      const center = getViewportCenter()
      const currentNodes = useBoardStore.getState().nodes
      const currentEdges = useBoardStore.getState().edges
      // Deduplication: check if node with same label exists
      const existingNode = currentNodes.find(n => (n.data.title || '').trim().toLowerCase() === nodeResponse.title.trim().toLowerCase())
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
        const currentEdges = useBoardStore.getState().edges
        const newNode = currentNodes[currentNodes.length - 1]
        if (newNode && newNode.data.title === nodeResponse.title) {
          // Update node with full content and metadata
          useBoardStore.getState().updateNode(newNode.id, {
            data: {
              ...newNode.data,
              content: nodeResponse.content,
              aiGenerated: true,
            }
          })
          
          // --- Connect to referenced node if present and not root ---
          if (referencedNodeTitles && referencedNodeTitles.length > 0) {
            const refTitle = referencedNodeTitles[0];
            const refNode = currentNodes.find(n => (n.data.title || '').trim() === refTitle.trim());
            const rootId = getRootNodeId(currentNodes, currentEdges);
            if (refNode && refNode.id !== rootId) {
              // Check for existing edge
              const edgeExists = currentEdges.some(e => e.source === refNode.id && e.target === newNode.id);
              if (!edgeExists) {
                useBoardStore.getState().addEdge({ source: refNode.id, target: newNode.id, data: { type: 'ai', label: 'AI context' } });
              }
            }
          }

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
        const sourceNode = currentNodes.find(n => n.data.title === connection.source)
        const targetNode = currentNodes.find(n => n.data.title === connection.target)
        
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
  const applyAllNodes = useCallback(async (messageId: string, referencedNodeTitles?: string[]) => {
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
      
      // Find referenced node (first, not root)
      let refNodeId: string | null = null;
      if (referencedNodeTitles && referencedNodeTitles.length > 0) {
        const refTitle = referencedNodeTitles[0];
        const refNode = useBoardStore.getState().nodes.find(n => (n.data.title || '').trim() === refTitle.trim());
        const rootId = getRootNodeId(useBoardStore.getState().nodes, useBoardStore.getState().edges);
        if (refNode && refNode.id !== rootId) {
          refNodeId = refNode.id;
        }
      }

      // Deduplication: get current nodes
      const currentNodes = useBoardStore.getState().nodes
      // Apply all nodes first
      const appliedNodeTitles: string[] = []
      for (let i = 0; i < nodeResponses.length; i++) {
        const nodeResponse = nodeResponses[i]
        const position = positions[i]
        // Deduplication: check if node with same label exists
        const existingNode = currentNodes.find(n => (n.data.title || '').trim().toLowerCase() === nodeResponse.title.trim().toLowerCase())
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
            n.data.title === nodeResponse.title && 
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

        // Connect new nodes to referenced node if needed
        if (refNodeId) {
          setTimeout(() => {
            const currentNodes = useBoardStore.getState().nodes;
            const currentEdges = useBoardStore.getState().edges;
            for (let i = 0; i < nodeResponses.length; i++) {
              const nodeResponse = nodeResponses[i];
              const newNode = currentNodes.find(n => n.data.title === nodeResponse.title && Math.abs(n.position.x - positions[i].x) < 50 && Math.abs(n.position.y - positions[i].y) < 50);
              if (newNode) {
                // Check for existing edge
                const edgeExists = currentEdges.some(e => e.source === refNodeId && e.target === newNode.id);
                if (!edgeExists) {
                  useBoardStore.getState().addEdge({ source: refNodeId, target: newNode.id, data: { type: 'ai', label: 'AI context' } });
                }
              }
            }
          }, 100); // Delay for connections and node positioning
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
      content: 'Nodal activated — your thinking partner, knowledge architect, and curious collaborator. Let\'s map it out together.',
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