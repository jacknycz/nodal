import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { 
  AIConfig, 
  AIError, 
  UsageStats, 
  AIServiceState, 
  AIRequest,
  AIResponse,
  StreamingAIResponse,
  OpenAIModel,
  UserPreferences,
  AIActionType
} from './aiTypes'
import { OpenAIService, createOpenAIService, getOpenAIService } from './aiService'
import { AIConfigManager, getAIConfigManager } from './aiConfig'

// Context State Interface
interface AIContextState {
  // Service State
  service: OpenAIService | null
  isInitialized: boolean
  isConnected: boolean
  
  // Configuration
  config: AIConfig | null
  userPreferences: UserPreferences
  
  // Status & Stats
  usageStats: UsageStats
  error: AIError | null
  activeRequestCount: number
  
  // Actions
  initialize: (apiKey: string) => Promise<boolean>
  updateConfig: (updates: Partial<AIConfig>) => Promise<boolean>
  updateUserPreferences: (preferences: Partial<UserPreferences>) => boolean
  clearError: () => void
  healthCheck: () => Promise<boolean>
  
  // AI Operations
  generate: (request: AIRequest) => Promise<AIResponse>
  generateStream: (request: AIRequest) => AsyncGenerator<StreamingAIResponse, void, unknown>
  selectOptimalModel: (actionType: AIActionType) => OpenAIModel
  cancel: (requestId?: string) => void
  
  // Configuration Management
  setAPIKey: (apiKey: string) => Promise<boolean>
  applyPreset: (presetName: string) => Promise<boolean>
  getConfigurationStatus: () => {
    configured: boolean
    hasAPIKey: boolean
    hasValidConfig: boolean
    errors: string[]
  }
}

// Create Context
const AIContext = createContext<AIContextState | null>(null)

// Provider Props
interface AIProviderProps {
  children: ReactNode
}

// AI Provider Component
export function AIProvider({ children }: AIProviderProps) {
  // State
  const [service, setService] = useState<OpenAIService | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => {
    const manager = getAIConfigManager()
    return manager.getUserPreferences()
  })
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    requestsByModel: {} as any,
    tokensByModel: {} as any,
    costsByModel: {} as any,
    dailyUsage: []
  })
  const [error, setError] = useState<AIError | null>(null)
  const [activeRequestCount, setActiveRequestCount] = useState(0)

  // Configuration Manager
  const configManager = getAIConfigManager()

  // Initialize AI service
  const initialize = useCallback(async (apiKey: string): Promise<boolean> => {
    try {
      setError(null)
      
      // Set API key in config manager
      const success = await configManager.setAPIKey(apiKey)
      if (!success) {
        setError({
          code: 'invalid_api_key',
          message: 'Invalid API key format',
          timestamp: new Date()
        })
        return false
      }

      // Get updated config
      const newConfig = configManager.getConfig()
      if (!newConfig) {
        setError({
          code: 'unknown_error',
          message: 'Failed to load configuration',
          timestamp: new Date()
        })
        return false
      }

      // Create AI service
      const newService = createOpenAIService(newConfig)
      
      // Test connection
      const isHealthy = await newService.healthCheck()
      if (!isHealthy) {
        setError({
          code: 'network_error',
          message: 'Failed to connect to OpenAI API',
          timestamp: new Date()
        })
        return false
      }

      // Update state
      setService(newService)
      setConfig(newConfig)
      setIsInitialized(true)
      setIsConnected(true)
      setUsageStats(newService.getUsageStats())

      return true
    } catch (err) {
      setError({
        code: 'unknown_error',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        timestamp: new Date()
      })
      return false
    }
  }, [configManager])

  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<AIConfig>): Promise<boolean> => {
    try {
      const success = await configManager.updateConfig(updates)
      if (success) {
        const newConfig = configManager.getConfig()
        if (newConfig && service) {
          service.updateConfig(newConfig)
          setConfig(newConfig)
        }
      }
      return success
    } catch (err) {
      setError({
        code: 'unknown_error',
        message: err instanceof Error ? err.message : 'Failed to update configuration',
        timestamp: new Date()
      })
      return false
    }
  }, [configManager, service])

  // Update user preferences
  const updateUserPreferences = useCallback((preferences: Partial<UserPreferences>): boolean => {
    try {
      const success = configManager.saveUserPreferences(preferences)
      if (success) {
        setUserPreferences(configManager.getUserPreferences())
      }
      return success
    } catch (err) {
      setError({
        code: 'unknown_error',
        message: err instanceof Error ? err.message : 'Failed to update preferences',
        timestamp: new Date()
      })
      return false
    }
  }, [configManager])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Health check
  const healthCheck = useCallback(async (): Promise<boolean> => {
    if (!service) return false
    
    try {
      const isHealthy = await service.healthCheck()
      setIsConnected(isHealthy)
      return isHealthy
    } catch (err) {
      setIsConnected(false)
      setError({
        code: 'network_error',
        message: 'Health check failed',
        timestamp: new Date()
      })
      return false
    }
  }, [service])

  // AI Generation
  const generate = useCallback(async (request: AIRequest): Promise<AIResponse> => {
    if (!service) {
      throw new Error('AI service not initialized')
    }

    try {
      setActiveRequestCount(prev => prev + 1)
      const response = await service.generate(request)
      setUsageStats(service.getUsageStats())
      return response
    } catch (err) {
      const aiError = err as AIError
      setError(aiError)
      throw aiError
    } finally {
      setActiveRequestCount(prev => Math.max(0, prev - 1))
    }
  }, [service])

  // Streaming AI Generation
  const generateStream = useCallback(async function* (request: AIRequest): AsyncGenerator<StreamingAIResponse, void, unknown> {
    if (!service) {
      throw new Error('AI service not initialized')
    }

    try {
      setActiveRequestCount(prev => prev + 1)
      
      for await (const chunk of service.generateStream(request)) {
        yield chunk
        
        if (chunk.isComplete) {
          setUsageStats(service.getUsageStats())
        }
      }
    } catch (err) {
      const aiError = err as AIError
      setError(aiError)
      throw aiError
    } finally {
      setActiveRequestCount(prev => Math.max(0, prev - 1))
    }
  }, [service])

  // Select optimal model
  const selectOptimalModel = useCallback((actionType: AIActionType): OpenAIModel => {
    if (!service) {
      return 'gpt-4o-mini'  // Default fallback
    }
    return service.selectOptimalModel(actionType)
  }, [service])

  // Cancel requests
  const cancel = useCallback((requestId?: string) => {
    if (service) {
      service.cancel(requestId)
      setActiveRequestCount(service.getActiveRequestCount())
    }
  }, [service])

  // Set API key
  const setAPIKey = useCallback(async (apiKey: string): Promise<boolean> => {
    return await initialize(apiKey)
  }, [initialize])

  // Apply preset
  const applyPreset = useCallback(async (presetName: string): Promise<boolean> => {
    try {
      const success = await configManager.applyPreset(presetName)
      if (success) {
        const newConfig = configManager.getConfig()
        if (newConfig && service) {
          service.updateConfig(newConfig)
          setConfig(newConfig)
        }
      }
      return success
    } catch (err) {
      setError({
        code: 'unknown_error',
        message: err instanceof Error ? err.message : 'Failed to apply preset',
        timestamp: new Date()
      })
      return false
    }
  }, [configManager, service])

  // Get configuration status
  const getConfigurationStatus = useCallback(() => {
    return configManager.getConfigurationStatus()
  }, [configManager])

  // Load initial configuration on mount
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        const savedConfig = await configManager.loadConfig()
        if (savedConfig) {
          const success = await initialize(savedConfig.apiKey)
          if (!success) {
            console.warn('Failed to initialize AI service with saved config')
          }
        }
      } catch (err) {
        console.error('Failed to load initial AI configuration:', err)
      }
    }

    loadInitialConfig()
  }, [configManager, initialize])

  // Listen for config changes
  useEffect(() => {
    const unsubscribe = configManager.addConfigListener((newConfig) => {
      setConfig(newConfig)
      
      if (newConfig && service) {
        service.updateConfig(newConfig)
      }
    })

    return unsubscribe
  }, [configManager, service])

  // Update active request count periodically
  useEffect(() => {
    if (!service) return

    const interval = setInterval(() => {
      setActiveRequestCount(service.getActiveRequestCount())
    }, 1000)

    return () => clearInterval(interval)
  }, [service])

  // Context value
  const contextValue: AIContextState = {
    // Service State
    service,
    isInitialized,
    isConnected,
    
    // Configuration
    config,
    userPreferences,
    
    // Status & Stats
    usageStats,
    error,
    activeRequestCount,
    
    // Actions
    initialize,
    updateConfig,
    updateUserPreferences,
    clearError,
    healthCheck,
    
    // AI Operations
    generate,
    generateStream,
    selectOptimalModel,
    cancel,
    
    // Configuration Management
    setAPIKey,
    applyPreset,
    getConfigurationStatus
  }

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  )
}

// Hook to use AI context
export function useAIContext(): AIContextState {
  const context = useContext(AIContext)
  
  if (!context) {
    throw new Error('useAIContext must be used within an AIProvider')
  }
  
  return context
}

// Convenience hooks for specific AI functionality
export function useAI() {
  const context = useAIContext()
  
  return {
    generate: context.generate,
    generateStream: context.generateStream,
    isLoading: context.activeRequestCount > 0,
    error: context.error,
    clearError: context.clearError,
    cancel: context.cancel,
    usageStats: context.usageStats
  }
}

export function useAIConfig() {
  const context = useAIContext()
  
  return {
    config: context.config,
    userPreferences: context.userPreferences,
    isInitialized: context.isInitialized,
    isConnected: context.isConnected,
    updateConfig: context.updateConfig,
    updateUserPreferences: context.updateUserPreferences,
    setAPIKey: context.setAPIKey,
    applyPreset: context.applyPreset,
    getConfigurationStatus: context.getConfigurationStatus,
    healthCheck: context.healthCheck
  }
}

export function useAIStatus() {
  const context = useAIContext()
  
  return {
    isInitialized: context.isInitialized,
    isConnected: context.isConnected,
    error: context.error,
    activeRequestCount: context.activeRequestCount,
    usageStats: context.usageStats,
    clearError: context.clearError
  }
} 