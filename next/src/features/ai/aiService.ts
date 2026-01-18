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
  AIActionType
} from './aiTypes'
import { AIErrorCode } from './aiTypes'
import { getSupabaseClient } from '../auth/supabaseClient'
import { fetchUsageCached } from './usageClient'

// Model Information Database
export const MODEL_INFO: Record<OpenAIModel, ModelInfo> = {
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
  },
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Latest flagship model with improved reasoning and multimodal capabilities',
    maxTokens: 200000,
    costPer1k: 0.01,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Smaller, faster GPT-5 variant optimized for cost and latency',
    maxTokens: 200000,
    costPer1k: 0.002,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  },
  'anthropic/claude-3-5-sonnet-20241022': {
    id: 'anthropic/claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude (via AI Gateway)',
    maxTokens: 200000,
    costPer1k: 0.005,
    capabilities: { streaming: true, functionCalling: true, vision: true }
  },
  'anthropic/claude-3-5-haiku-20241022': {
    id: 'anthropic/claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Anthropic Claude (fast) (via AI Gateway)',
    maxTokens: 200000,
    costPer1k: 0.002,
    capabilities: { streaming: true, functionCalling: true, vision: false }
  },
  'xai/grok-2': {
    id: 'xai/grok-2',
    name: 'Grok 2',
    description: 'xAI Grok (via AI Gateway)',
    maxTokens: 128000,
    costPer1k: 0.005,
    capabilities: { streaming: true, functionCalling: true, vision: false }
  },
  'xai/grok-2-mini': {
    id: 'xai/grok-2-mini',
    name: 'Grok 2 Mini',
    description: 'xAI Grok (smaller/faster) (via AI Gateway)',
    maxTokens: 128000,
    costPer1k: 0.002,
    capabilities: { streaming: true, functionCalling: true, vision: false }
  }
}

interface RateLimiter {
  requests: { timestamp: number; count: number }[]
  tokens: { timestamp: number; count: number }[]
}

function stripHtmlToText(input: string): string {
  const s = String(input || '')
  // naive but safe: remove tags and collapse whitespace
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function sanitizeForPrompt(input: string, maxLen: number): string {
  const s = stripHtmlToText(String(input || ''))
    .replace(/https?:\/\/\S+/gi, '') // strip URLs; they are noisy and rarely helpful in prompts
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen).trim() : s
}

function buildBoardSnapshot(context?: AIContext): string {
  const board = context?.board
  if (!board) return ''

  const topic = sanitizeForPrompt(String(context?.topic || ''), 140)
  const summary = sanitizeForPrompt(String(board?.boardSummary || ''), 1200)

  // Budget knobs (character-based; service uses ~4 chars/token estimate)
  const MAX_NODE_LINES = 60
  const PER_NODE_SNIPPET = 260
  const TOTAL_BUDGET = 9000

  const nodes: any[] = Array.isArray(board.nodes) ? board.nodes : []
  const edges: any[] = Array.isArray(board.edges) ? board.edges : []

  const byId = new Map<string, any>(nodes.map((n: any) => [String(n?.id || ''), n]))
  const selectedId = board.selectedNodeId ? String(board.selectedNodeId) : ''
  const selectedNode = selectedId ? byId.get(selectedId) : null
  const selectedTitle = sanitizeForPrompt(String(selectedNode?.data?.title || selectedNode?.data?.label || ''), 80)

  let used = 0
  const lines: string[] = []
  const pushLine = (line: string) => {
    const add = line.length + 1
    if (used + add > TOTAL_BUDGET) return false
    used += add
    lines.push(line)
    return true
  }

  pushLine('Board snapshot (for grounding; do not restate verbatim unless asked):')
  pushLine('Role: You are an expert in this board’s topic. Use general knowledge plus the board context.')
  pushLine('Ground answers in the board when possible. If you go beyond the board, label assumptions clearly.')
  if (topic) pushLine(`Topic: ${topic}`)
  if (summary) pushLine(`Summary: ${summary}`)
  if (selectedTitle) pushLine(`Selected node: "${selectedTitle}"`)
  pushLine(`Node count: ${nodes.length}, Edge count: ${edges.length}`)

  // Include a compact directory of node titles/types + snippets
  pushLine('Nodes (titles + compact snippets; avoid duplication):')
  const take = nodes.slice(0, Math.max(0, MAX_NODE_LINES))
  for (const n of take) {
    const title = sanitizeForPrompt(String(n?.data?.title || n?.data?.label || ''), 80) || 'Untitled'
    const type = sanitizeForPrompt(String(n?.type || 'node'), 20) || 'node'
    // Phase A: never rely on extractedText persisted in boards.data (keep full text in documents table)
    const raw = n?.data?.content || ''
    const snippet = sanitizeForPrompt(String(raw || ''), PER_NODE_SNIPPET)
    const line = snippet ? `- [${type}] ${title} — ${snippet}` : `- [${type}] ${title}`
    if (!pushLine(line)) break
  }
  const omitted = Math.max(0, nodes.length - take.length)
  if (omitted > 0) pushLine(`- … (+${omitted} more nodes not shown)`)

  // Minimal edge hinting (structure)
  if (used < TOTAL_BUDGET - 800 && edges.length) {
    pushLine('Edges (sample; for structure only):')
    const MAX_EDGES = 20
    for (const e of edges.slice(0, MAX_EDGES)) {
      const sId = String((e as any)?.source || '')
      const tId = String((e as any)?.target || '')
      const sT = sanitizeForPrompt(String(byId.get(sId)?.data?.title || ''), 60) || sId
      const tT = sanitizeForPrompt(String(byId.get(tId)?.data?.title || ''), 60) || tId
      if (!pushLine(`- ${sT} -> ${tT}`)) break
    }
  }

  return lines.join('\n').trim()
}

function buildConversationMessages(context?: AIContext): Array<{ role: 'user' | 'assistant'; content: string }> {
  const convo = context?.conversation
  const msgs: any[] = Array.isArray(convo?.messages) ? convo!.messages : []
  if (!msgs.length) return []

  const MAX_TURNS = 12
  const PER_MSG_MAX = 1200
  const TOTAL_BUDGET = 6000

  const filtered = msgs
    .filter((m: any) => m?.role === 'user' || m?.role === 'assistant')
    .slice(-MAX_TURNS)

  const out: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let used = 0
  for (const m of filtered) {
    const content = sanitizeForPrompt(String(m?.content || ''), PER_MSG_MAX)
    if (!content) continue
    const add = content.length + 1
    if (used + add > TOTAL_BUDGET) break
    used += add
    out.push({ role: m.role, content })
  }
  return out
}

export class OpenAIService {
  private config: AIConfig
  private rateLimiter: RateLimiter
  private activeRequests = new Map<string, AbortController>()
  private usageStats: UsageStats

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

  selectOptimalModel(actionType: AIActionType): OpenAIModel {
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
  buildContext(): AIContext {
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
  private categorizeError(error: unknown): AIError {
    const now = new Date()
    
    if (error && typeof error === 'object' && 'status' in error) {
      const errorObj = error as { status: number; message?: string }
      
      if (errorObj.status === 401) {
        return {
          code: AIErrorCode.INVALID_API_KEY,
          message: 'Invalid API key provided',
          timestamp: now,
          details: error as Record<string, unknown>
        }
      }
      
      if (errorObj.status === 429) {
        return {
          code: AIErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded',
          timestamp: now,
          details: error as Record<string, unknown>
        }
      }
      if (errorObj.status === 402) {
        return {
          code: AIErrorCode.QUOTA_EXCEEDED,
          message: errorObj.message || 'Monthly AI token limit reached',
          timestamp: now,
          details: error as Record<string, unknown>
        }
      }
      
      if (errorObj.status === 400 && errorObj.message?.includes('maximum context length')) {
        return {
          code: AIErrorCode.CONTEXT_TOO_LONG,
          message: 'Context length exceeds model limit',
          timestamp: now,
          details: error as Record<string, unknown>
        }
      }
      
      if (errorObj.status === 400 && errorObj.message?.includes('content_filter')) {
        return {
          code: AIErrorCode.CONTENT_FILTERED,
          message: 'Content filtered by OpenAI',
          timestamp: now,
          details: error as Record<string, unknown>
        }
      }
    }
    
    if (!navigator.onLine || (error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'NetworkError')) {
      return {
        code: AIErrorCode.NETWORK_ERROR,
        message: 'Network connection error',
        timestamp: now,
        details: error as Record<string, unknown>
      }
    }
    
    return {
      code: AIErrorCode.UNKNOWN_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: now,
      details: error as Record<string, unknown>
    }
  }

  // Retry Logic
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: unknown
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
                 // Don't retry on certain errors
         const aiError = this.categorizeError(error)
        if (aiError.code === AIErrorCode.INVALID_API_KEY || 
            aiError.code === AIErrorCode.CONTENT_FILTERED || 
            aiError.code === AIErrorCode.CONTEXT_TOO_LONG ||
           aiError.code === AIErrorCode.RATE_LIMIT_EXCEEDED ||
            aiError.code === AIErrorCode.QUOTA_EXCEEDED) {
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
    const estimatedTokens = this.estimateTokens(request.prompt, request.systemPrompt, request.context)

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
    const { prompt, systemPrompt, temperature, maxTokens, imageUrl, context } = request

    const messages: any[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : [])
    ]

    const boardSnapshot = buildBoardSnapshot(context)
    if (boardSnapshot) {
      messages.push({ role: 'system' as const, content: boardSnapshot })
    }

    const convoMessages = buildConversationMessages(context)
    for (const m of convoMessages) {
      messages.push({ role: m.role as const, content: m.content })
    }

    if (imageUrl && MODEL_INFO[model].capabilities.vision) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      })
    } else {
      messages.push({ role: 'user' as const, content: prompt })
    }

    const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || '/api/ai'
    let authHeader: Record<string, string> = {}
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (token) authHeader = { 'Authorization': `Bearer ${token}` }
    } catch {}
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The server route reads the key from server env; allow an override header if needed
        ...(this.config.apiKey ? { 'x-openai-api-key': this.config.apiKey } : {}),
        ...authHeader
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? this.config.defaultSettings.temperature,
        max_tokens: maxTokens ?? this.config.defaultSettings.maxTokens,
        presence_penalty: 0.3,
        frequency_penalty: 0.6,
        stop: ["END_OF_RESPONSE"],
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
    const { prompt, systemPrompt, temperature, maxTokens, context } = request

    const messages: any[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ]
    const boardSnapshot = buildBoardSnapshot(context)
    if (boardSnapshot) {
      messages.push({ role: 'system' as const, content: boardSnapshot })
    }
    const convoMessages = buildConversationMessages(context)
    for (const m of convoMessages) {
      messages.push({ role: m.role as const, content: m.content })
    }
    messages.push({ role: 'user' as const, content: prompt })

    const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || '/api/ai'
    let authHeader: Record<string, string> = {}
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (token) authHeader = { 'Authorization': `Bearer ${token}` }
    } catch {}
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'x-openai-api-key': this.config.apiKey } : {}),
        ...authHeader
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? this.config.defaultSettings.temperature,
        max_tokens: maxTokens ?? this.config.defaultSettings.maxTokens,
        presence_penalty: 0.3,
        frequency_penalty: 0.6,
        stop: ["END_OF_RESPONSE"],
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
              console.debug('Skipping invalid JSON in stream:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private estimateTokens(prompt: string, systemPrompt?: string, context?: AIContext): number {
    // Rough estimation: ~4 characters per token (better than nothing; keep predictable)
    const boardSnapshot = buildBoardSnapshot(context)
    const convo = buildConversationMessages(context).map(m => m.content).join('\n')
    const totalContent = (prompt + (systemPrompt || '') + (boardSnapshot || '') + (convo || '')).length
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
      // Lightweight reachability/auth check that does NOT consume AI tokens
      const result = await fetchUsageCached({ maxAgeMs: 30_000 })
      // No session returns ok=true with status=204 in the helper; treat as reachable.
      return !!result.ok
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