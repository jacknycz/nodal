interface AIConfig {
  apiKey: string
  baseUrl: string
}

interface GenerateOptions {
  temperature?: number
  maxTokens?: number
  model?: string
}

export default class AIClient {
  constructor(config: AIConfig) {
    // Stub implementation
  }

  async generate(prompt: string, options: GenerateOptions = {}) {
    return { content: 'AI response coming soon...' }
  }
} 