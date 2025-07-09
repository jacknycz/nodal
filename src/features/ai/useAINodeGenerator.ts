import { useCallback, useState } from 'react'
import { useAI } from './useAI'
import { useBoard } from '../board/useBoard'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useBoardStore } from '../board/boardSlice'
import type { OpenAIModel } from './aiTypes'
import type { BoardNode } from '../board/boardTypes'

export interface AINodeGeneratorOptions {
  model?: OpenAIModel
  includeContext?: boolean
  maxRelatedNodes?: number
  positionStrategy?: 'center' | 'circular' | 'grid' | 'connected'
  temperature?: number
}

export interface UseAINodeGeneratorResult {
  generateNode: (prompt: string, options?: AINodeGeneratorOptions) => Promise<string | null>
  generateContextualNodes: (count?: number, options?: AINodeGeneratorOptions) => Promise<string[]>
  generateBridgeNode: (sourceNodeId: string, targetNodeId: string, options?: AINodeGeneratorOptions) => Promise<string | null>
  generateRelatedCluster: (centerNodeId: string, count?: number, options?: AINodeGeneratorOptions) => Promise<string[]>
  isGenerating: boolean
  error: string | null
}

export function useAINodeGenerator(): UseAINodeGeneratorResult {
  const { generate } = useAI()
  const { addNode, nodes, selectedNode } = useBoard()
  const { getViewportCenter } = useViewportCenter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate smart positioning for new nodes
  const calculatePosition = useCallback((strategy: string, count: number = 1, existingPositions: Array<{x: number, y: number}> = []) => {
    const center = getViewportCenter()
    const positions: Array<{x: number, y: number}> = []
    
    switch (strategy) {
      case 'circular':
        const radius = 200
        const angleStep = (2 * Math.PI) / count
        for (let i = 0; i < count; i++) {
          const angle = i * angleStep
          positions.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
          })
        }
        break
        
      case 'grid':
        const gridSize = Math.ceil(Math.sqrt(count))
        const spacing = 180
        const startX = center.x - ((gridSize - 1) * spacing) / 2
        const startY = center.y - ((gridSize - 1) * spacing) / 2
        
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / gridSize)
          const col = i % gridSize
          positions.push({
            x: startX + col * spacing,
            y: startY + row * spacing
          })
        }
        break
        
      case 'connected':
        if (selectedNode) {
          const spacing = 200
          for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count
            positions.push({
              x: selectedNode.position.x + Math.cos(angle) * spacing,
              y: selectedNode.position.y + Math.sin(angle) * spacing
            })
          }
        } else {
          // Fallback to center
          positions.push({ x: center.x, y: center.y })
        }
        break
        
      default: // 'center'
        const offset = count > 1 ? 50 : 0
        for (let i = 0; i < count; i++) {
          positions.push({
            x: center.x + (i - (count - 1) / 2) * offset,
            y: center.y + (i - (count - 1) / 2) * offset
          })
        }
    }
    
    return positions
  }, [getViewportCenter, selectedNode])

  // Build context for AI generation
  const buildContext = useCallback((includeContext: boolean = true) => {
    if (!includeContext) return ''
    
    const contextNodes = nodes.slice(0, 10) // Limit context size
    const boardContext = contextNodes.map(node => 
      `- ${node.data.label}${node.data.content ? `: ${node.data.content.slice(0, 100)}` : ''}`
    ).join('\n')
    
    const selectedContext = selectedNode 
      ? `\n\nCurrently selected node: "${selectedNode.data.label}"${selectedNode.data.content ? `\nContent: ${selectedNode.data.content}` : ''}`
      : ''
    
    return boardContext.length > 0 
      ? `\n\nExisting nodes on the board:\n${boardContext}${selectedContext}`
      : selectedContext
  }, [nodes, selectedNode])

  // Two-stage generation: title first, then content
  const generateNodeContent = useCallback(async (
    title: string, 
    context: string,
    model: OpenAIModel = 'gpt-4o-mini',
    temperature: number = 0.7
  ): Promise<string> => {
    const contentPrompt = `Generate detailed content for a knowledge graph node with the title: "${title}"

${context}

Provide comprehensive but concise content that:
- Explains the concept clearly
- Relates to the existing context
- Is suitable for a knowledge graph
- Is informative and actionable

Content (2-4 sentences):`

    const response = await generate(contentPrompt, {
      model,
      temperature,
      maxTokens: 200,
      systemPrompt: 'You are a helpful assistant that creates educational content for knowledge graphs. Focus on clarity, relevance, and educational value.'
    })

    return response.content.trim()
  }, [generate])

  // Main node generation function
  const generateNode = useCallback(async (
    prompt: string,
    options: AINodeGeneratorOptions = {}
  ): Promise<string | null> => {
    const {
      model = 'gpt-4o-mini',
      includeContext = true,
      positionStrategy = 'center',
      temperature = 0.7
    } = options

    setIsGenerating(true)
    setError(null)

    try {
      const context = buildContext(includeContext)
      
      // Stage 1: Generate title
      const titlePrompt = `Generate a concise, descriptive title for a knowledge graph node based on this request: "${prompt}"

${context}

The title should be:
- Clear and specific (2-6 words)
- Suitable for a knowledge graph
- Unique from existing nodes
- Professionally worded

Title:`

      const titleResponse = await generate(titlePrompt, {
        model,
        temperature,
        maxTokens: 50,
        systemPrompt: 'You are a helpful assistant that creates titles for knowledge graph nodes. Focus on clarity and uniqueness.'
      })

      const title = titleResponse.content.trim().replace(/^["']|["']$/g, '') // Remove quotes
      
      // Stage 2: Generate content
      const content = await generateNodeContent(title, context, model, temperature)
      
      // Position and create node
      const positions = calculatePosition(positionStrategy, 1)
      const position = positions[0]
      
      // Add the node to the board
      addNode(title, position)
      
      // Get the newly created node and update with content and AI flag
      // We need to wait a tick for the node to be added
      setTimeout(() => {
        const newNodes = useBoardStore.getState().nodes
        const newNode = newNodes[newNodes.length - 1] // Get the last added node
        if (newNode && newNode.data.label === title) {
          useBoardStore.getState().updateNode(newNode.id, {
            data: {
              ...newNode.data,
              content,
              aiGenerated: true
            }
          })
        }
      }, 10)
      
      return title
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate node'
      setError(errorMessage)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [generate, buildContext, calculatePosition, addNode, generateNodeContent])

  // Generate multiple contextual nodes
  const generateContextualNodes = useCallback(async (
    count: number = 3,
    options: AINodeGeneratorOptions = {}
  ): Promise<string[]> => {
    const {
      model = 'gpt-4o-mini',
      positionStrategy = 'circular',
      temperature = 0.8
    } = options

    setIsGenerating(true)
    setError(null)

    try {
      const context = buildContext(true)
      
      if (context.length === 0) {
        throw new Error('No context available. Add some nodes to the board first.')
      }

      // Generate multiple related concepts
      const prompt = `Based on this knowledge graph, suggest ${count} related concepts that would extend and complement the existing knowledge:

${context}

Generate concepts that:
- Fill knowledge gaps
- Provide different perspectives
- Connect to existing nodes
- Add educational value

Provide only the concept titles, one per line:`

      const response = await generate(prompt, {
        model,
        temperature,
        maxTokens: 200,
        systemPrompt: 'You are a helpful assistant that expands knowledge graphs with relevant, complementary concepts.'
      })

      const titles = response.content
        .split('\n')
        .map(line => line.trim().replace(/^[-•*\d.]\s*/, '').replace(/^["']|["']$/g, ''))
        .filter(title => title.length > 0)
        .slice(0, count)

      if (titles.length === 0) {
        throw new Error('Failed to generate node titles')
      }

      // Generate positions for all nodes
      const positions = calculatePosition(positionStrategy, titles.length)
      
      // Create nodes with content
      const createdTitles: string[] = []
      
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i]
        const position = positions[i]
        
        // Generate content for this specific title
        const content = await generateNodeContent(title, context, model, temperature)
        
        // Add node
        addNode(title, position)
        
        // Update with content and AI flag
        setTimeout(() => {
          const newNodes = useBoardStore.getState().nodes
          const newNode = newNodes.find(n => n.data.label === title && n.position.x === position.x)
          if (newNode) {
            useBoardStore.getState().updateNode(newNode.id, {
              data: {
                ...newNode.data,
                content,
                aiGenerated: true
              }
            })
          }
        }, 10 + i * 5) // Stagger updates slightly
        
        createdTitles.push(title)
      }
      
      return createdTitles
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate contextual nodes'
      setError(errorMessage)
      return []
    } finally {
      setIsGenerating(false)
    }
  }, [generate, buildContext, calculatePosition, addNode, generateNodeContent])

  // Generate a bridge node between two nodes
  const generateBridgeNode = useCallback(async (
    sourceNodeId: string,
    targetNodeId: string,
    options: AINodeGeneratorOptions = {}
  ): Promise<string | null> => {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7
    } = options

    setIsGenerating(true)
    setError(null)

    try {
      const sourceNode = nodes.find(n => n.id === sourceNodeId)
      const targetNode = nodes.find(n => n.id === targetNodeId)
      
      if (!sourceNode || !targetNode) {
        throw new Error('Source or target node not found')
      }

      const prompt = `Create a bridge concept that connects these two knowledge graph nodes:

Node A: "${sourceNode.data.label}"
${sourceNode.data.content ? `Content: ${sourceNode.data.content}` : ''}

Node B: "${targetNode.data.label}"
${targetNode.data.content ? `Content: ${targetNode.data.content}` : ''}

Generate a connecting concept that:
- Links these two ideas logically
- Helps explain their relationship
- Adds educational value
- Is concise and clear

Bridge concept title:`

      const titleResponse = await generate(prompt, {
        model,
        temperature,
        maxTokens: 50,
        systemPrompt: 'You are a helpful assistant that creates connecting concepts for knowledge graphs.'
      })

      const title = titleResponse.content.trim().replace(/^["']|["']$/g, '')
      
      // Generate content
      const contentPrompt = `Provide detailed content for the bridge concept "${title}" that connects:
- ${sourceNode.data.label}
- ${targetNode.data.label}

Explain how this concept relates to both nodes and helps understand their connection.

Content:`

      const contentResponse = await generate(contentPrompt, {
        model,
        temperature,
        maxTokens: 200,
        systemPrompt: 'You are a helpful assistant that creates educational content for knowledge graphs.'
      })

      const content = contentResponse.content.trim()
      
      // Position between the two nodes
      const position = {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2
      }
      
      // Add the bridge node
      addNode(title, position)
      
      // Update with content and AI flag
      setTimeout(() => {
        const newNodes = useBoardStore.getState().nodes
        const newNode = newNodes.find(n => n.data.label === title && Math.abs(n.position.x - position.x) < 10)
        if (newNode) {
          useBoardStore.getState().updateNode(newNode.id, {
            data: {
              ...newNode.data,
              content,
              aiGenerated: true
            }
          })
        }
      }, 10)
      
      return title
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate bridge node'
      setError(errorMessage)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [generate, nodes, addNode])

  // Generate a cluster of related nodes around a center node
  const generateRelatedCluster = useCallback(async (
    centerNodeId: string,
    count: number = 4,
    options: AINodeGeneratorOptions = {}
  ): Promise<string[]> => {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.8
    } = options

    setIsGenerating(true)
    setError(null)

    try {
      const centerNode = nodes.find(n => n.id === centerNodeId)
      if (!centerNode) {
        throw new Error('Center node not found')
      }

      const prompt = `Generate ${count} related concepts that extend and complement this knowledge graph node:

Center Node: "${centerNode.data.label}"
${centerNode.data.content ? `Content: ${centerNode.data.content}` : ''}

Generate concepts that:
- Are directly related to the center concept
- Provide different aspects or applications
- Include prerequisites, components, or outcomes
- Add educational depth

Provide only the concept titles, one per line:`

      const response = await generate(prompt, {
        model,
        temperature,
        maxTokens: 150,
        systemPrompt: 'You are a helpful assistant that creates related concepts for knowledge graphs.'
      })

      const titles = response.content
        .split('\n')
        .map(line => line.trim().replace(/^[-•*\d.]\s*/, '').replace(/^["']|["']$/g, ''))
        .filter(title => title.length > 0)
        .slice(0, count)

      if (titles.length === 0) {
        throw new Error('Failed to generate related titles')
      }

      // Position in a circle around the center node
      const radius = 200
      const angleStep = (2 * Math.PI) / titles.length
      const createdTitles: string[] = []
      
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i]
        const angle = i * angleStep
        const position = {
          x: centerNode.position.x + Math.cos(angle) * radius,
          y: centerNode.position.y + Math.sin(angle) * radius
        }
        
        // Generate content
        const content = await generateNodeContent(
          title, 
          `Related to: ${centerNode.data.label}${centerNode.data.content ? ` - ${centerNode.data.content}` : ''}`,
          model,
          temperature
        )
        
        // Add node
        addNode(title, position)
        
        // Update with content and AI flag
        setTimeout(() => {
          const newNodes = useBoardStore.getState().nodes
          const newNode = newNodes.find(n => n.data.label === title && Math.abs(n.position.x - position.x) < 10)
          if (newNode) {
            useBoardStore.getState().updateNode(newNode.id, {
              data: {
                ...newNode.data,
                content,
                aiGenerated: true
              }
            })
          }
        }, 10 + i * 5)
        
        createdTitles.push(title)
      }
      
      return createdTitles
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate related cluster'
      setError(errorMessage)
      return []
    } finally {
      setIsGenerating(false)
    }
  }, [generate, nodes, addNode, generateNodeContent])

  return {
    generateNode,
    generateContextualNodes,
    generateBridgeNode,
    generateRelatedCluster,
    isGenerating,
    error
  }
} 