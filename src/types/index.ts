// Global application types
export interface AppConfig {
  name: string
  version: string
  environment: 'development' | 'production' | 'test'
  features: {
    ai: boolean
    focus: boolean
    storage: boolean
    export: boolean
  }
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  autoSave: boolean
  aiEnabled: boolean
  keyboardShortcuts: boolean
}

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export interface Modal {
  id: string
  title: string
  content: React.ReactNode
  onClose?: () => void
  onConfirm?: () => void
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Event types
export interface AppEvent {
  type: string
  payload?: any
  timestamp: number
}

export interface NodeEvent extends AppEvent {
  type: 'node:created' | 'node:updated' | 'node:deleted' | 'node:selected'
  payload: {
    nodeId: string
    node?: any
  }
}

export interface EdgeEvent extends AppEvent {
  type: 'edge:created' | 'edge:deleted'
  payload: {
    edgeId: string
    edge?: any
  }
}

export interface BoardEvent extends AppEvent {
  type: 'board:cleared' | 'board:saved' | 'board:loaded' | 'board:exported'
  payload?: any
}

// Node-Aware AI Response Types
export interface ConnectionSuggestion {
  source: string // Node title to connect from
  target: string // Node title to connect to  
  type?: 'default' | 'ai' | 'focus'
  reason?: string // Why this connection makes sense
  strength?: number // Connection strength (0-1)
}

export interface NodeResponse {
  title: string
  type: 'note' | 'question' | 'task' | 'action' | 'code' | 'concept'
  content: string
  metadata?: {
    tags?: string[]
    connections?: string[]
    priority?: 'low' | 'medium' | 'high'
    [key: string]: any
  }
  apply: boolean
}

export interface AIResponse {
  message?: string // Optional regular chat message
  nodeResponse?: NodeResponse // Optional structured node
  multipleNodes?: NodeResponse[] // For multiple node suggestions
  connections?: ConnectionSuggestion[] // Optional connection suggestions
}

export interface ParsedAIResponse {
  hasStructuredResponse: boolean
  regularMessage: string
  nodeResponses: NodeResponse[]
  connectionSuggestions: ConnectionSuggestion[]
} 