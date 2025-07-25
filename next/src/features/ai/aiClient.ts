interface AIConfig {
  apiKey: string
  baseUrl: string
}

export default class AIClient {
  constructor(config: AIConfig) {
    // Stub implementation
  }

  async generate(prompt: string, options: any = {}) {
    return { content: 'AI response coming soon...' }
  }
} 