interface AIConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}

interface AIRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

class AIClient {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      ...config,
    }
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { prompt, systemPrompt, temperature = 0.7, maxTokens = 1000 } = request

    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ]

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage,
      }
    } catch (error) {
      console.error('AI API request failed:', error)
      throw error
    }
  }

  async expandNode(nodeLabel: string, nodeContent?: string): Promise<string> {
    const prompt = `Expand on the concept: "${nodeLabel}"${nodeContent ? `\n\nCurrent content: ${nodeContent}` : ''}\n\nPlease provide a detailed explanation or expansion of this concept.`

    const response = await this.generateText({
      prompt,
      systemPrompt: 'You are a helpful assistant that expands on concepts and ideas. Provide clear, concise, and informative explanations.',
      temperature: 0.7,
      maxTokens: 500,
    })

    return response.content
  }

  async generateRelatedNodes(nodeLabel: string, count: number = 3): Promise<string[]> {
    const prompt = `Generate ${count} related concepts or ideas that connect to: "${nodeLabel}"\n\nProvide only the concept names, one per line, without explanations.`

    const response = await this.generateText({
      prompt,
      systemPrompt: 'You are a helpful assistant that generates related concepts and ideas. Provide only concept names, one per line.',
      temperature: 0.8,
      maxTokens: 200,
    })

    return response.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, count)
  }

  async suggestConnections(nodes: Array<{ id: string; label: string }>): Promise<Array<{ source: string; target: string; reason: string }>> {
    const nodeList = nodes.map(node => `${node.id}: ${node.label}`).join('\n')
    const prompt = `Given these nodes:\n${nodeList}\n\nSuggest logical connections between them. For each connection, provide the source node ID, target node ID, and a brief reason for the connection. Format as: sourceId -> targetId: reason`

    const response = await this.generateText({
      prompt,
      systemPrompt: 'You are a helpful assistant that suggests logical connections between concepts. Provide connections in the specified format.',
      temperature: 0.6,
      maxTokens: 400,
    })

    const connections: Array<{ source: string; target: string; reason: string }> = []
    const lines = response.content.split('\n')

    for (const line of lines) {
      const match = line.match(/^(\w+)\s*->\s*(\w+):\s*(.+)$/)
      if (match) {
        connections.push({
          source: match[1],
          target: match[2],
          reason: match[3].trim(),
        })
      }
    }

    return connections
  }
}

export default AIClient
export type { AIConfig, AIRequest, AIResponse } 