import type {
  OpenAIModel,
  ModelInfo,
  AIRequest,
  AIResponse,
  StreamingAIResponse,
  AIContext,
  AIConfig,
  AIError,
  UsageStats,
  AIAction,
  AIActionType
} from './aiTypes'
import { AIErrorCode } from './aiTypes'

// Model Information Database
export const MODEL_INFO: Record<OpenAIModel, ModelInfo> = {
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Most capable model, best for complex reasoning',
    maxTokens: 8192,
    costPer1k: 0.03,
    capabilities: { streaming: true, functionCalling: true, vision: false }
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Fast and capable, great balance of speed and quality',
    maxTokens: 128000,
    costPer1k: 0.01,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and cost-effective for simple tasks',
    maxTokens: 16384,
    costPer1k: 0.0015,
    capabilities: { streaming: true, functionCalling: true, vision: false }
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Latest multimodal model with vision capabilities',
    maxTokens: 128000,
    costPer1k: 0.005,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Lightweight version of GPT-4o, faster and cheaper',
    maxTokens: 128000,
    costPer1k: 0.00015,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  }
}

interface RateLimiter {
  requests: { timestamp: number; count: number }[]
  tokens: { timestamp: number; count: number }[]
}

interface RequestQueue {
  id: string
  request: AIRequest
  resolve: (response: AIResponse) => void
  reject: (error: AIError) => void
  attempts: number
  maxAttempts: number
}

export class OpenAIService {
  private config: AIConfig
  private rateLimiter: RateLimiter
  private requestQueue: RequestQueue[] = []
  private activeRequests = new Map<string, AbortController>()
  private usageStats: UsageStats
  private isProcessingQueue = false

  constructor(config: AIConfig) {
    this.config = config
    this.rateLimiter = { requests: [], tokens: [] }
    this.usageStats = this.initializeUsageStats()
  }

  private initializeUsageStats(): UsageStats {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      requestsByModel: {} as Record<OpenAIModel, number>,
      tokensByModel: {} as Record<OpenAIModel, number>,
      costsByModel: {} as Record<OpenAIModel, number>,
      dailyUsage: []
    }
  }

  // Configuration Management
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): AIConfig {
    return { ...this.config }
  }

  // Model Information
  getAvailableModels(): ModelInfo[] {
    return Object.values(MODEL_INFO)
  }

  getModelInfo(model: OpenAIModel): ModelInfo {
    return MODEL_INFO[model]
  }

  selectOptimalModel(actionType: AIActionType, context?: AIContext): OpenAIModel {
    // Smart model selection based on action type and context
    switch (actionType) {
      case 'chat':
        return this.config.modelPreferences.chat
      case 'expand_node':
      case 'generate_related':
      case 'improve_content':
        return this.config.modelPreferences.nodeGeneration
      case 'process_document':
        return this.config.modelPreferences.documentProcessing
      case 'analyze_board':
      case 'suggest_connections':
        return this.config.modelPreferences.analysis
      default:
        return this.config.defaultModel
    }
  }

  // Context Building
  buildContext(options: {
    includeBoard?: boolean
    includeDocuments?: boolean
    includeConversation?: boolean
    focusedOnly?: boolean
  } = {}): AIContext {
    const context: AIContext = {}

    // This will be implemented when we have access to board state
    // For now, return empty context
    return context
  }

  // Rate Limiting
  private checkRateLimit(tokensNeeded: number = 0): boolean {
    const now = Date.now()
    const oneMinute = 60 * 1000

    // Clean old entries
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      entry => now - entry.timestamp < oneMinute
    )
    this.rateLimiter.tokens = this.rateLimiter.tokens.filter(
      entry => now - entry.timestamp < oneMinute
    )

    // Check request rate limit
    const currentRequests = this.rateLimiter.requests.reduce(
      (sum, entry) => sum + entry.count, 0
    )
    if (currentRequests >= this.config.rateLimiting.requestsPerMinute) {
      return false
    }

    // Check token rate limit
    const currentTokens = this.rateLimiter.tokens.reduce(
      (sum, entry) => sum + entry.count, 0
    )
    if (currentTokens + tokensNeeded > this.config.rateLimiting.tokensPerMinute) {
      return false
    }

    return true
  }

  private recordRateLimit(tokens: number): void {
    const now = Date.now()
    this.rateLimiter.requests.push({ timestamp: now, count: 1 })
    this.rateLimiter.tokens.push({ timestamp: now, count: tokens })
  }

  // Error Handling
  private categorizeError(error: any): AIError {
    const now = new Date()
    
    if (error.status === 401) {
      return {
        code: AIErrorCode.INVALID_API_KEY,
        message: 'Invalid API key provided',
        timestamp: now,
        details: error
      }
    }
    
    if (error.status === 429) {
      return {
        code: AIErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        timestamp: now,
        details: error
      }
    }
    
    if (error.status === 400 && error.message?.includes('maximum context length')) {
      return {
        code: AIErrorCode.CONTEXT_TOO_LONG,
        message: 'Context length exceeds model limit',
        timestamp: now,
        details: error
      }
    }
    
    if (error.status === 400 && error.message?.includes('content_filter')) {
      return {
        code: AIErrorCode.CONTENT_FILTERED,
        message: 'Content filtered by OpenAI',
        timestamp: now,
        details: error
      }
    }
    
    if (!navigator.onLine || error.name === 'NetworkError') {
      return {
        code: AIErrorCode.NETWORK_ERROR,
        message: 'Network connection error',
        timestamp: now,
        details: error
      }
    }
    
    return {
      code: AIErrorCode.UNKNOWN_ERROR,
      message: error.message || 'Unknown error occurred',
      timestamp: now,
      details: error
    }
  }

  // Retry Logic
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
                 // Don't retry on certain errors
         const aiError = this.categorizeError(error)
         const nonRetryableErrors = [
           AIErrorCode.INVALID_API_KEY,
           AIErrorCode.CONTENT_FILTERED,
           AIErrorCode.CONTEXT_TOO_LONG
         ] as const
         if (nonRetryableErrors.includes(aiError.code as any)) {
           throw aiError
         }
        
        if (attempt === maxAttempts) {
          throw this.categorizeError(lastError)
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw this.categorizeError(lastError)
  }

  // Usage Tracking
  private updateUsageStats(response: AIResponse): void {
    if (!response.usage) return

    const { usage, model } = response
    const cost = this.calculateCost(usage.totalTokens, model)

    this.usageStats.totalRequests++
    this.usageStats.totalTokens += usage.totalTokens
    this.usageStats.totalCost += cost

    // Initialize model stats if needed
    if (!this.usageStats.requestsByModel[model]) {
      this.usageStats.requestsByModel[model] = 0
      this.usageStats.tokensByModel[model] = 0
      this.usageStats.costsByModel[model] = 0
    }

    this.usageStats.requestsByModel[model]++
    this.usageStats.tokensByModel[model] += usage.totalTokens
    this.usageStats.costsByModel[model] += cost

    // Update daily usage
    const today = new Date().toISOString().split('T')[0]
    let dailyEntry = this.usageStats.dailyUsage.find(d => d.date === today)
    
    if (!dailyEntry) {
      dailyEntry = { date: today, requests: 0, tokens: 0, cost: 0 }
      this.usageStats.dailyUsage.push(dailyEntry)
    }
    
    dailyEntry.requests++
    dailyEntry.tokens += usage.totalTokens
    dailyEntry.cost += cost
  }

  private calculateCost(tokens: number, model: OpenAIModel): number {
    const modelInfo = MODEL_INFO[model]
    return (tokens / 1000) * modelInfo.costPer1k
  }

  getUsageStats(): UsageStats {
    return { ...this.usageStats }
  }

  // Core Generation Methods
  async generate(request: AIRequest): Promise<AIResponse> {
    const requestId = crypto.randomUUID()
    const model = request.model || this.config.defaultModel
    const estimatedTokens = this.estimateTokens(request.prompt, request.systemPrompt)

    // Check rate limiting
    if (!this.checkRateLimit(estimatedTokens)) {
      throw this.categorizeError({
        status: 429,
        message: 'Rate limit would be exceeded'
      })
    }

    const abortController = new AbortController()
    this.activeRequests.set(requestId, abortController)

    try {
      const response = await this.withRetry(async () => {
        return await this.makeOpenAIRequest(request, model, abortController.signal)
      })

      this.recordRateLimit(response.usage?.totalTokens || estimatedTokens)
      this.updateUsageStats(response)
      
      return response
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  async *generateStream(request: AIRequest): AsyncGenerator<StreamingAIResponse, void, unknown> {
    const requestId = crypto.randomUUID()
    const model = request.model || this.config.defaultModel
    const abortController = new AbortController()
    this.activeRequests.set(requestId, abortController)

    try {
      const stream = await this.makeOpenAIStreamRequest(request, model, abortController.signal)
      
      let fullContent = ''
      
      for await (const chunk of stream) {
        fullContent += chunk.delta
        yield {
          content: fullContent,
          delta: chunk.delta,
          isComplete: chunk.isComplete,
          usage: chunk.usage
        }
        
        if (chunk.isComplete && chunk.usage) {
          this.updateUsageStats({
            content: fullContent,
            model,
            usage: chunk.usage
          })
        }
      }
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  private async makeOpenAIRequest(
    request: AIRequest,
    model: OpenAIModel,
    signal: AbortSignal
  ): Promise<AIResponse> {
    const { prompt, systemPrompt, temperature, maxTokens } = request

    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ]

    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? this.config.defaultSettings.temperature,
        max_tokens: maxTokens ?? this.config.defaultSettings.maxTokens,
        stream: false
      }),
      signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw {
        status: response.status,
        message: errorData.error?.message || response.statusText,
        details: errorData
      }
    }

    const data = await response.json()
    
    return {
      content: data.choices[0]?.message?.content || '',
      model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        cost: this.calculateCost(data.usage.total_tokens, model)
      } : undefined,
      finishReason: data.choices[0]?.finish_reason
    }
  }

  private async *makeOpenAIStreamRequest(
    request: AIRequest,
    model: OpenAIModel,
    signal: AbortSignal
  ): AsyncGenerator<StreamingAIResponse, void, unknown> {
    const { prompt, systemPrompt, temperature, maxTokens } = request

    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ]

    const baseUrl = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? this.config.defaultSettings.temperature,
        max_tokens: maxTokens ?? this.config.defaultSettings.maxTokens,
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw {
        status: response.status,
        message: errorData.error?.message || response.statusText,
        details: errorData
      }
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield {
                content: fullContent,
                delta: '',
                isComplete: true
              }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices[0]?.delta?.content || ''
              fullContent += delta

              yield {
                content: fullContent,
                delta,
                isComplete: false,
                usage: parsed.usage ? {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                  cost: this.calculateCost(parsed.usage.total_tokens, model)
                } : undefined
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private estimateTokens(prompt: string, systemPrompt?: string): number {
    // Rough estimation: ~4 characters per token
    const totalContent = (prompt + (systemPrompt || '')).length
    return Math.ceil(totalContent / 4)
  }

  // Request Management
  cancel(requestId?: string): void {
    if (requestId) {
      const controller = this.activeRequests.get(requestId)
      if (controller) {
        controller.abort()
        this.activeRequests.delete(requestId)
      }
    } else {
      // Cancel all active requests
      for (const [id, controller] of this.activeRequests) {
        controller.abort()
        this.activeRequests.delete(id)
      }
    }
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generate({
        prompt: 'Test',
        maxTokens: 5
      })
      return !!response.content
    } catch {
      return false
    }
  }
}

// Singleton instance
let openAIServiceInstance: OpenAIService | null = null

export function createOpenAIService(config: AIConfig): OpenAIService {
  openAIServiceInstance = new OpenAIService(config)
  return openAIServiceInstance
}

export function getOpenAIService(): OpenAIService | null {
  return openAIServiceInstance
} 