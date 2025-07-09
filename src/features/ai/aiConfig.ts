import type { AIConfig, OpenAIModel, UserPreferences } from './aiTypes'

// Default Configuration
export const DEFAULT_AI_CONFIG: Omit<AIConfig, 'apiKey'> = {
  defaultModel: 'gpt-4o-mini',
  modelPreferences: {
    chat: 'gpt-4o',
    nodeGeneration: 'gpt-4o-mini',
    documentProcessing: 'gpt-4-turbo',
    analysis: 'gpt-4'
  },
  defaultSettings: {
    temperature: 0.7,
    maxTokens: 1000,
    stream: false
  },
  rateLimiting: {
    requestsPerMinute: 50,
    tokensPerMinute: 40000
  },
  costTracking: {
    enabled: true,
    monthlyBudget: 50.0,
    alertThreshold: 0.8
  }
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredModel: 'gpt-4o-mini',
  temperature: 0.7,
  verbosity: 'detailed',
  language: 'en',
  assistantPersonality: 'professional'
}

// Configuration Storage Keys
const STORAGE_KEYS = {
  AI_CONFIG: 'nodal_ai_config',
  USER_PREFERENCES: 'nodal_user_preferences',
  USAGE_STATS: 'nodal_usage_stats',
  API_KEY: 'nodal_api_key'
} as const

// Configuration Validation
export function validateAPIKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false
  }
  
  // OpenAI API keys start with 'sk-' and are 51 characters long
  const apiKeyRegex = /^sk-[a-zA-Z0-9]{48}$/
  return apiKeyRegex.test(apiKey)
}

export function validateModel(model: string): model is OpenAIModel {
  const validModels: OpenAIModel[] = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'gpt-4o',
    'gpt-4o-mini'
  ]
  return validModels.includes(model as OpenAIModel)
}

export function validateTemperature(temperature: number): boolean {
  return typeof temperature === 'number' && temperature >= 0 && temperature <= 2
}

export function validateMaxTokens(maxTokens: number): boolean {
  return typeof maxTokens === 'number' && maxTokens > 0 && maxTokens <= 128000
}

export function validateAIConfig(config: Partial<AIConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate API key if provided
  if (config.apiKey && !validateAPIKey(config.apiKey)) {
    errors.push('Invalid API key format')
  }

  // Validate models
  if (config.defaultModel && !validateModel(config.defaultModel)) {
    errors.push('Invalid default model')
  }

  if (config.modelPreferences) {
    const { chat, nodeGeneration, documentProcessing, analysis } = config.modelPreferences
    if (chat && !validateModel(chat)) errors.push('Invalid chat model')
    if (nodeGeneration && !validateModel(nodeGeneration)) errors.push('Invalid node generation model')
    if (documentProcessing && !validateModel(documentProcessing)) errors.push('Invalid document processing model')
    if (analysis && !validateModel(analysis)) errors.push('Invalid analysis model')
  }

  // Validate settings
  if (config.defaultSettings) {
    const { temperature, maxTokens } = config.defaultSettings
    if (temperature !== undefined && !validateTemperature(temperature)) {
      errors.push('Temperature must be between 0 and 2')
    }
    if (maxTokens !== undefined && !validateMaxTokens(maxTokens)) {
      errors.push('Max tokens must be between 1 and 128000')
    }
  }

  // Validate rate limiting
  if (config.rateLimiting) {
    const { requestsPerMinute, tokensPerMinute } = config.rateLimiting
    if (requestsPerMinute !== undefined && (requestsPerMinute < 1 || requestsPerMinute > 1000)) {
      errors.push('Requests per minute must be between 1 and 1000')
    }
    if (tokensPerMinute !== undefined && (tokensPerMinute < 100 || tokensPerMinute > 1000000)) {
      errors.push('Tokens per minute must be between 100 and 1,000,000')
    }
  }

  // Validate cost tracking
  if (config.costTracking) {
    const { monthlyBudget, alertThreshold } = config.costTracking
    if (monthlyBudget !== undefined && monthlyBudget < 0) {
      errors.push('Monthly budget must be positive')
    }
    if (alertThreshold !== undefined && (alertThreshold < 0 || alertThreshold > 1)) {
      errors.push('Alert threshold must be between 0 and 1')
    }
  }

  return { valid: errors.length === 0, errors }
}

// Configuration Manager Class
export class AIConfigManager {
  private config: AIConfig | null = null
  private userPreferences: UserPreferences
  private listeners: Set<(config: AIConfig | null) => void> = new Set()

  constructor() {
    this.userPreferences = this.loadUserPreferences()
    this.loadConfig()
  }

  // Configuration Management
  async loadConfig(): Promise<AIConfig | null> {
    try {
      // Try to load from localStorage first
      const saved = localStorage.getItem(STORAGE_KEYS.AI_CONFIG)
      const apiKey = this.getStoredAPIKey()

      if (saved && apiKey) {
        const parsedConfig = JSON.parse(saved)
        const fullConfig: AIConfig = {
          ...DEFAULT_AI_CONFIG,
          ...parsedConfig,
          apiKey
        }

        const validation = validateAIConfig(fullConfig)
        if (validation.valid) {
          this.config = fullConfig
          this.notifyListeners()
          return this.config
        } else {
          console.warn('Invalid AI config found, using defaults:', validation.errors)
        }
      }

      // If no valid config, try to create one with stored API key
      if (apiKey) {
        this.config = {
          ...DEFAULT_AI_CONFIG,
          apiKey
        }
        this.notifyListeners()
        return this.config
      }

      this.config = null
      this.notifyListeners()
      return null
    } catch (error) {
      console.error('Failed to load AI config:', error)
      this.config = null
      this.notifyListeners()
      return null
    }
  }

  async saveConfig(config: AIConfig): Promise<boolean> {
    try {
      const validation = validateAIConfig(config)
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`)
      }

      // Save API key separately for security
      this.setStoredAPIKey(config.apiKey)

      // Save config without API key
      const { apiKey, ...configWithoutKey } = config
      localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(configWithoutKey))

      this.config = config
      this.notifyListeners()
      return true
    } catch (error) {
      console.error('Failed to save AI config:', error)
      return false
    }
  }

  getConfig(): AIConfig | null {
    return this.config ? { ...this.config } : null
  }

  async updateConfig(updates: Partial<AIConfig>): Promise<boolean> {
    if (!this.config) return false

    const newConfig = { ...this.config, ...updates }
    return await this.saveConfig(newConfig)
  }

  async clearConfig(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.AI_CONFIG)
      this.clearStoredAPIKey()
      this.config = null
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to clear AI config:', error)
    }
  }

  // API Key Management
  private getStoredAPIKey(): string | null {
    try {
      // In a real app, you'd want more secure storage
      return localStorage.getItem(STORAGE_KEYS.API_KEY)
    } catch {
      return null
    }
  }

  private setStoredAPIKey(apiKey: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
    } catch (error) {
      console.error('Failed to store API key:', error)
    }
  }

  private clearStoredAPIKey(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.API_KEY)
    } catch (error) {
      console.error('Failed to clear API key:', error)
    }
  }

  async setAPIKey(apiKey: string): Promise<boolean> {
    if (!validateAPIKey(apiKey)) {
      return false
    }

    if (this.config) {
      return await this.updateConfig({ apiKey })
    } else {
      // Create new config with API key
      const newConfig: AIConfig = {
        ...DEFAULT_AI_CONFIG,
        apiKey
      }
      return await this.saveConfig(newConfig)
    }
  }

  getAPIKey(): string | null {
    return this.config?.apiKey || null
  }

  // User Preferences Management
  loadUserPreferences(): UserPreferences {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...DEFAULT_USER_PREFERENCES, ...parsed }
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
    return { ...DEFAULT_USER_PREFERENCES }
  }

  saveUserPreferences(preferences: Partial<UserPreferences>): boolean {
    try {
      this.userPreferences = { ...this.userPreferences, ...preferences }
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(this.userPreferences))
      return true
    } catch (error) {
      console.error('Failed to save user preferences:', error)
      return false
    }
  }

  getUserPreferences(): UserPreferences {
    return { ...this.userPreferences }
  }

  // Configuration Status
  isConfigured(): boolean {
    return this.config !== null && validateAPIKey(this.config.apiKey)
  }

  getConfigurationStatus(): {
    configured: boolean
    hasAPIKey: boolean
    hasValidConfig: boolean
    errors: string[]
  } {
    const hasAPIKey = !!this.getAPIKey()
    const validation = this.config ? validateAIConfig(this.config) : { valid: false, errors: ['No configuration found'] }
    
    return {
      configured: this.isConfigured(),
      hasAPIKey,
      hasValidConfig: validation.valid,
      errors: validation.errors
    }
  }

  // Configuration Presets
  getModelPresets(): Record<string, Partial<AIConfig>> {
    return {
      'cost-effective': {
        defaultModel: 'gpt-3.5-turbo',
        modelPreferences: {
          chat: 'gpt-3.5-turbo',
          nodeGeneration: 'gpt-3.5-turbo',
          documentProcessing: 'gpt-3.5-turbo',
          analysis: 'gpt-4o-mini'
        }
      },
      'balanced': {
        defaultModel: 'gpt-4o-mini',
        modelPreferences: {
          chat: 'gpt-4o-mini',
          nodeGeneration: 'gpt-4o-mini',
          documentProcessing: 'gpt-4-turbo',
          analysis: 'gpt-4o'
        }
      },
      'premium': {
        defaultModel: 'gpt-4',
        modelPreferences: {
          chat: 'gpt-4',
          nodeGeneration: 'gpt-4',
          documentProcessing: 'gpt-4-turbo',
          analysis: 'gpt-4'
        }
      }
    }
  }

  async applyPreset(presetName: string): Promise<boolean> {
    const presets = this.getModelPresets()
    const preset = presets[presetName]
    
    if (!preset) return false
    
    return await this.updateConfig(preset)
  }

  // Event Listeners
  addConfigListener(listener: (config: AIConfig | null) => void): () => void {
    this.listeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config)
      } catch (error) {
        console.error('Error in config listener:', error)
      }
    })
  }

  // Utility Methods
  estimateMonthlyUsage(): {
    requestsPerDay: number
    tokensPerDay: number
    estimatedMonthlyCost: number
  } {
    // This would be based on actual usage stats
    // For now, return rough estimates
    return {
      requestsPerDay: 100,
      tokensPerDay: 50000,
      estimatedMonthlyCost: 15.0
    }
  }

  getRecommendedSettings(usage: 'light' | 'moderate' | 'heavy'): Partial<AIConfig> {
    switch (usage) {
      case 'light':
        return {
          defaultModel: 'gpt-3.5-turbo',
          rateLimiting: {
            requestsPerMinute: 20,
            tokensPerMinute: 10000
          }
        }
      case 'moderate':
        return {
          defaultModel: 'gpt-4o-mini',
          rateLimiting: {
            requestsPerMinute: 50,
            tokensPerMinute: 40000
          }
        }
      case 'heavy':
        return {
          defaultModel: 'gpt-4o',
          rateLimiting: {
            requestsPerMinute: 100,
            tokensPerMinute: 100000
          }
        }
    }
  }
}

// Singleton instance
let configManagerInstance: AIConfigManager | null = null

export function getAIConfigManager(): AIConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new AIConfigManager()
  }
  return configManagerInstance
}

export function createAIConfigManager(): AIConfigManager {
  configManagerInstance = new AIConfigManager()
  return configManagerInstance
} 