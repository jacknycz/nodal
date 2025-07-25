import type { BoardNode, BoardEdge } from '../board/boardTypes'

// OpenAI Model Types
export type OpenAIModel = 
  | 'gpt-4' 
  | 'gpt-4-turbo' 
  | 'gpt-3.5-turbo' 
  | 'gpt-4o' 
  | 'gpt-4o-mini'

export interface ModelInfo {
  id: OpenAIModel
  name: string
  description: string
  maxTokens: number
  costPer1k: number
  capabilities: {
    streaming: boolean
    functionCalling: boolean
    vision: boolean
  }
}

// Request/Response Types
export interface AIRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: OpenAIModel
  stream?: boolean
  context?: AIContext
}

export interface AIResponse {
  content: string
  model: OpenAIModel
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost?: number
  }
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls'
}

export interface StreamingAIResponse {
  content: string
  delta: string
  isComplete: boolean
  usage?: AIResponse['usage']
}

// Context Types
export interface BoardContext {
  nodes: BoardNode[]
  edges: BoardEdge[]
  selectedNodeId: string | null
  focusedNodeIds: string[]
  boardSummary?: string
}

export interface DocumentContext {
  documents: DocumentInfo[]
  embeddings?: EmbeddingInfo[]
}

export interface DocumentInfo {
  id: string
  name: string
  type: string
  content: string
  uploadedAt: Date
  nodeIds: string[] // Nodes created from this document
}

export interface EmbeddingInfo {
  documentId: string
  chunks: {
    id: string
    content: string
    embedding: number[]
    metadata: Record<string, any>
  }[]
}

export interface ConversationContext {
  messages: ChatMessage[]
  sessionId: string
  startedAt: Date
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    nodeId?: string
    actionType?: string
    tokens?: number
  }
}

export interface AIContext {
  board?: BoardContext
  documents?: DocumentContext
  conversation?: ConversationContext
  userPreferences?: UserPreferences
  topic?: string
}

// Configuration Types
export interface AIConfig {
  apiKey: string
  defaultModel: OpenAIModel
  modelPreferences: {
    chat: OpenAIModel
    nodeGeneration: OpenAIModel
    documentProcessing: OpenAIModel
    analysis: OpenAIModel
  }
  defaultSettings: {
    temperature: number
    maxTokens: number
    stream: boolean
  }
  rateLimiting: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
  costTracking: {
    enabled: boolean
    monthlyBudget?: number
    alertThreshold?: number
  }
}

export interface UserPreferences {
  preferredModel: OpenAIModel
  temperature: number
  verbosity: 'concise' | 'detailed' | 'comprehensive'
  language: string
  assistantPersonality: 'professional' | 'friendly' | 'creative'
}

// Service State Types
export interface AIServiceState {
  isInitialized: boolean
  isConnected: boolean
  config: AIConfig | null
  activeRequests: Map<string, AIRequest>
  usageStats: UsageStats
  error: AIError | null
}

export interface UsageStats {
  totalRequests: number
  totalTokens: number
  totalCost: number
  requestsByModel: Record<OpenAIModel, number>
  tokensByModel: Record<OpenAIModel, number>
  costsByModel: Record<OpenAIModel, number>
  dailyUsage: {
    date: string
    requests: number
    tokens: number
    cost: number
  }[]
}

// Error Types
export interface AIError {
  code: AIErrorCode
  message: string
  details?: any
  timestamp: Date
  requestId?: string
}

export const AIErrorCode = {
  INVALID_API_KEY: 'invalid_api_key',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  MODEL_NOT_AVAILABLE: 'model_not_available',
  CONTEXT_TOO_LONG: 'context_too_long',
  CONTENT_FILTERED: 'content_filtered',
  NETWORK_ERROR: 'network_error',
  QUOTA_EXCEEDED: 'quota_exceeded',
  UNKNOWN_ERROR: 'unknown_error'
} as const

export type AIErrorCode = typeof AIErrorCode[keyof typeof AIErrorCode]

// Hook Types
export interface UseAIOptions {
  model?: OpenAIModel
  temperature?: number
  maxTokens?: number
  stream?: boolean
  context?: Partial<AIContext>
}

export interface UseAIResult {
  generate: (prompt: string, options?: Partial<AIRequest>) => Promise<AIResponse>
  generateStream: (prompt: string, options?: Partial<AIRequest>) => AsyncGenerator<StreamingAIResponse>
  isLoading: boolean
  error: AIError | null
  usage: UsageStats
  cancel: () => void
}

export interface UseNodeAIResult {
  expandNode: () => Promise<void>
  generateRelatedNodes: (count?: number) => Promise<string[]>
  improveNode: () => Promise<void>
  generateQuestions: () => Promise<string[]>
  analyzeNode: () => Promise<string>
  isLoading: boolean
  error: AIError | null
}

// Action Types
export type AIActionType = 
  | 'expand_node'
  | 'generate_related'
  | 'improve_content'
  | 'generate_questions'
  | 'analyze_board'
  | 'chat'
  | 'process_document'
  | 'suggest_connections'

export interface AIAction {
  id: string
  type: AIActionType
  nodeId?: string
  request: AIRequest
  response?: AIResponse
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

// Utility Types
export type AIContextBuilder = (options: {
  includeBoard?: boolean
  includeDocuments?: boolean
  includeConversation?: boolean
  focusedOnly?: boolean
}) => AIContext

export type ModelSelector = (actionType: AIActionType, context?: AIContext) => OpenAIModel 