import type { 
  AIActionType, 
  AIContext, 
  BoardContext, 
  DocumentContext,
  OpenAIModel 
} from './aiTypes'
import type { BoardNode } from '../board/boardTypes'

// 🧠 ACTION DETECTION TYPES
export interface DetectedAction {
  id: string
  type: ActionType
  intent: ActionIntent
  parameters: ActionParameters
  context: ActionContext
  confidence: number
  dependencies: string[]
  metadata: {
    originalText: string
    keywords: string[]
    entities: string[]
    sentiment: 'positive' | 'neutral' | 'negative'
  }
}

export type ActionType = 
  | 'create_single'      // Create one node
  | 'create_multiple'    // Create multiple nodes 
  | 'create_sequence'    // Create connected sequence
  | 'create_hierarchy'   // Create parent-child structure
  | 'analyze_board'      // Analyze board state
  | 'analyze_node'       // Analyze specific node
  | 'analyze_gap'        // Find missing elements
  | 'organize_nodes'     // Reorganize layout
  | 'connect_nodes'      // Create connections
  | 'expand_concept'     // Expand on idea
  | 'research_topic'     // Research and create
  | 'brainstorm_ideas'   // Generate ideas
  | 'plan_project'       // Project planning
  | 'improve_content'    // Enhance existing
  | 'document_process'   // Process document
  | 'custom_workflow'    // Multi-step custom

export interface ActionIntent {
  primary: string       // Main goal
  secondary?: string    // Additional goals
  scope: 'single' | 'multiple' | 'board' | 'document' | 'global'
  urgency: 'low' | 'medium' | 'high'
  complexity: 'simple' | 'moderate' | 'complex'
}

export interface ActionParameters {
  count?: number
  topic?: string
  style?: string
  target?: string
  constraints?: string[]
  preferences?: Record<string, any>
  customInstructions?: string
}

export interface ActionContext {
  selectedNodes: string[]
  boardState: 'empty' | 'sparse' | 'moderate' | 'dense'
  documentPresent: boolean
  conversationHistory: number
  userExpertise: 'beginner' | 'intermediate' | 'expert'
}

export interface ActionPattern {
  id: string
  name: string
  description: string
  patterns: RegExp[]
  keywords: string[]
  examples: string[]
  actionType: ActionType
  defaultParameters: ActionParameters
  requiredContext?: string[]
  confidence: number
}

export interface ActionSequence {
  id: string
  name: string
  description: string
  actions: DetectedAction[]
  estimatedTime: number
  complexity: 'simple' | 'moderate' | 'complex'
  dependencies: string[]
}

// 🎯 ACTION DETECTION ENGINE
export class ActionDetectionEngine {
  private patterns: ActionPattern[] = []
  private contextAnalyzer: ContextAnalyzer
  private intentClassifier: IntentClassifier
  private parameterExtractor: ParameterExtractor
  
  constructor() {
    this.contextAnalyzer = new ContextAnalyzer()
    this.intentClassifier = new IntentClassifier()
    this.parameterExtractor = new ParameterExtractor()
    this.initializePatterns()
  }
  
  // 🔍 MAIN DETECTION METHOD
  async detectActions(
    input: string, 
    context: AIContext
  ): Promise<DetectedAction[]> {
    // 1. Normalize input
    const normalizedInput = this.normalizeInput(input)
    
    // 2. Extract entities and keywords
    const entities = this.extractEntities(normalizedInput)
    const keywords = this.extractKeywords(normalizedInput)
    
    // 3. Analyze context
    const actionContext = this.contextAnalyzer.analyze(context)
    
    // 4. Classify intent
    const intent = await this.intentClassifier.classify(normalizedInput, actionContext)
    
    // 5. Match patterns
    const patternMatches = this.matchPatterns(normalizedInput, keywords, entities)
    
    // 6. Extract parameters
    const parameters = this.parameterExtractor.extract(normalizedInput, intent)
    
    // 7. Generate actions
    const actions = await this.generateActions(
      patternMatches,
      intent,
      parameters,
      actionContext,
      entities,
      keywords,
      normalizedInput
    )
    
    // 8. Validate and rank
    return this.validateAndRank(actions, context)
  }
  
  // 🎯 PATTERN MATCHING
  private matchPatterns(
    input: string, 
    keywords: string[], 
    entities: string[]
  ): { pattern: ActionPattern; confidence: number }[] {
    const matches: { pattern: ActionPattern; confidence: number }[] = []
    
    for (const pattern of this.patterns) {
      let confidence = 0
      
      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          confidence += 0.4
          break
        }
      }
      
      // Check keyword matches
      const keywordMatches = pattern.keywords.filter(keyword => 
        keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
      )
      confidence += (keywordMatches.length / pattern.keywords.length) * 0.6
      
      if (confidence > 0.3) {
        matches.push({ pattern, confidence })
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence)
  }
  
  // 🏗️ ACTION GENERATION
  private async generateActions(
    patternMatches: { pattern: ActionPattern; confidence: number }[],
    intent: ActionIntent,
    parameters: ActionParameters,
    actionContext: ActionContext,
    entities: string[],
    keywords: string[],
    originalText: string
  ): Promise<DetectedAction[]> {
    const actions: DetectedAction[] = []
    
    for (const { pattern, confidence } of patternMatches.slice(0, 3)) {
      const action: DetectedAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: pattern.actionType,
        intent,
        parameters: {
          ...pattern.defaultParameters,
          ...parameters
        },
        context: actionContext,
        confidence,
        dependencies: [],
        metadata: {
          originalText,
          keywords,
          entities,
          sentiment: this.analyzeSentiment(originalText)
        }
      }
      
      actions.push(action)
    }
    
    return actions
  }
  
  // 📊 VALIDATION AND RANKING
  private validateAndRank(
    actions: DetectedAction[], 
    context: AIContext
  ): DetectedAction[] {
    return actions
      .filter(action => this.validateAction(action, context))
      .sort((a, b) => {
        // Rank by confidence and context relevance
        const aScore = a.confidence + this.getContextRelevance(a, context)
        const bScore = b.confidence + this.getContextRelevance(b, context)
        return bScore - aScore
      })
      .slice(0, 5) // Top 5 actions
  }
  
  // 🔧 UTILITY METHODS
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  private extractEntities(input: string): string[] {
    // Simple entity extraction - can be enhanced with NLP libraries
    const entities: string[] = []
    
    // Numbers
    const numbers = input.match(/\b\d+\b/g)
    if (numbers) entities.push(...numbers)
    
    // Quoted strings
    const quotes = input.match(/"([^"]*)"/g)
    if (quotes) entities.push(...quotes.map(q => q.replace(/"/g, '')))
    
    // Capitalized words (potential proper nouns)
    const properNouns = input.match(/\b[A-Z][a-z]+\b/g)
    if (properNouns) entities.push(...properNouns)
    
    return [...new Set(entities)]
  }
  
  private extractKeywords(input: string): string[] {
    const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'])
    
    return input
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10) // Top 10 keywords
  }
  
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'like', 'best', 'perfect', 'wonderful']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'sucks', 'broken', 'wrong', 'error']
    
    const words = text.toLowerCase().split(/\s+/)
    const positiveCount = words.filter(w => positiveWords.includes(w)).length
    const negativeCount = words.filter(w => negativeWords.includes(w)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }
  
  private validateAction(action: DetectedAction, context: AIContext): boolean {
    // Basic validation rules
    if (action.confidence < 0.2) return false
    
    // Context-specific validation
    if (action.type.includes('node') && !context.board) return false
    if (action.type.includes('document') && !context.documents) return false
    
    return true
  }
  
  private getContextRelevance(action: DetectedAction, context: AIContext): number {
    let relevance = 0
    
    // Board context relevance
    if (context.board) {
      if (action.type.includes('create') && context.board.nodes.length < 5) {
        relevance += 0.2 // Boost creation for sparse boards
      }
      if (action.type.includes('organize') && context.board.nodes.length > 10) {
        relevance += 0.2 // Boost organization for dense boards
      }
    }
    
    // Selected node relevance
    if (context.board?.selectedNodeId && action.type.includes('analyze')) {
      relevance += 0.3
    }
    
    return relevance
  }
  
  // 📋 PATTERN INITIALIZATION
  private initializePatterns(): void {
    this.patterns = [
      // BRAINSTORMING PATTERNS (Check first - most specific)
      {
        id: 'brainstorm_ideas',
        name: 'Brainstorm Ideas',
        description: 'Generate creative ideas and concepts',
        patterns: [
          /brainstorm\s+(.+)/,
          /ideas?\s+for\s+(.+)/,
          /(.+?)(?:\s+ideas?)/,
          /create.+?ideas?/,
          /generate.+?ideas?/,
          /come\s+up\s+with\s+(.+)/,
          /think\s+of\s+(.+)/
        ],
        keywords: ['brainstorm', 'ideas', 'think', 'creative', 'concepts', 'flavor', 'generate'],
        examples: ['brainstorm marketing ideas', 'ideas for the app', 'coffee flavor ideas', 'create some ideas'],
        actionType: 'brainstorm_ideas',
        defaultParameters: { count: 3 },
        confidence: 0.9
      },

      // CREATE PATTERNS
      {
        id: 'create_single',
        name: 'Create Single Node',
        description: 'Create one node with specific content',
        patterns: [
          /create\s+(?:a|an)?\s*(.+?)(?:\s+node)?$/,
          /make\s+(?:a|an)?\s*(.+?)(?:\s+node)?$/,
          /add\s+(?:a|an)?\s*(.+?)(?:\s+node)?$/
        ],
        keywords: ['create', 'make', 'add', 'new', 'node'],
        examples: ['create a marketing node', 'make a todo list', 'add user research'],
        actionType: 'create_single',
        defaultParameters: { count: 1 },
        confidence: 0.8
      },
      
      {
        id: 'create_multiple',
        name: 'Create Multiple Nodes',
        description: 'Create multiple nodes with specific count',
        patterns: [
          /create\s+(\d+)\s+(.+?)(?:\s+nodes?)?$/,
          /create\s+(?:some|several|multiple)\s+(.+?)(?:\s+nodes?)?/,
          /make\s+(\d+)\s+(.+?)(?:\s+nodes?)?$/,
          /make\s+(?:some|several|multiple)\s+(.+?)(?:\s+nodes?)?/,
          /generate\s+(\d+)\s+(.+?)(?:\s+nodes?)?$/,
          /generate\s+(?:some|several|multiple)\s+(.+?)(?:\s+nodes?)?/
        ],
        keywords: ['create', 'make', 'generate', 'multiple', 'nodes', 'some', 'several'],
        examples: ['create 5 marketing nodes', 'create some nodes', 'make multiple items', 'generate several ideas'],
        actionType: 'create_multiple',
        defaultParameters: { count: 3 },
        confidence: 0.8
      },
      
      // ANALYSIS PATTERNS
      {
        id: 'analyze_board',
        name: 'Analyze Board',
        description: 'Analyze the current board state',
        patterns: [
          /analyze\s+(?:the\s+)?board/,
          /what.*missing/,
          /review\s+(?:the\s+)?board/,
          /overview\s+(?:of\s+)?(?:the\s+)?board/
        ],
        keywords: ['analyze', 'review', 'overview', 'missing', 'board'],
        examples: ['analyze the board', 'what is missing', 'review my board'],
        actionType: 'analyze_board',
        defaultParameters: {},
        confidence: 0.7
      },
      
      // ORGANIZATION PATTERNS
      {
        id: 'organize_nodes',
        name: 'Organize Nodes',
        description: 'Reorganize and structure nodes',
        patterns: [
          /organize\s+(?:the\s+)?nodes/,
          /clean\s+up\s+(?:the\s+)?board/,
          /structure\s+(?:the\s+)?board/,
          /arrange\s+(?:the\s+)?nodes/
        ],
        keywords: ['organize', 'clean', 'structure', 'arrange', 'layout'],
        examples: ['organize the nodes', 'clean up the board', 'structure my ideas'],
        actionType: 'organize_nodes',
        defaultParameters: {},
        confidence: 0.6
      },
      
      // PROJECT PLANNING PATTERNS
      {
        id: 'plan_project',
        name: 'Plan Project',
        description: 'Create comprehensive project plan',
        patterns: [
          /plan\s+(?:a\s+)?(.+?)(?:\s+project)?$/,
          /create\s+(?:a\s+)?(.+?)\s+plan$/,
          /design\s+(?:a\s+)?(.+?)(?:\s+strategy)?$/,
          /roadmap\s+for\s+(.+)/,
          /timeline\s+for\s+(.+)/
        ],
        keywords: ['plan', 'project', 'strategy', 'roadmap', 'timeline', 'phases', 'steps'],
        examples: ['plan a startup', 'create a marketing plan', 'design a strategy', 'project roadmap'],
        actionType: 'plan_project',
        defaultParameters: { count: 3 },
        confidence: 0.8
      },

      
      // RESEARCH PATTERNS
      {
        id: 'research_topic',
        name: 'Research Topic',
        description: 'Research and analyze a specific topic',
        patterns: [
          /research\s+(.+)/,
          /investigate\s+(.+)/,
          /learn\s+about\s+(.+)/,
          /explore\s+(.+)/
        ],
        keywords: ['research', 'investigate', 'learn', 'explore', 'study'],
        examples: ['research competitors', 'investigate market trends', 'learn about AI'],
        actionType: 'research_topic',
        defaultParameters: { count: 6 },
        confidence: 0.75
      }
    ]
  }
}

// 🔍 CONTEXT ANALYZER
class ContextAnalyzer {
  analyze(context: AIContext): ActionContext {
    const boardContext = context.board
    const documentContext = context.documents
    
    return {
      selectedNodes: boardContext?.selectedNodeId ? [boardContext.selectedNodeId] : [],
      boardState: this.analyzeBoardState(boardContext),
      documentPresent: (documentContext?.documents.length || 0) > 0,
      conversationHistory: context.conversation?.messages.length || 0,
      userExpertise: 'intermediate' // Default - can be enhanced
    }
  }
  
  private analyzeBoardState(board?: BoardContext): 'empty' | 'sparse' | 'moderate' | 'dense' {
    if (!board || board.nodes.length === 0) return 'empty'
    if (board.nodes.length < 5) return 'sparse'
    if (board.nodes.length < 15) return 'moderate'
    return 'dense'
  }
}

// 🎯 INTENT CLASSIFIER
class IntentClassifier {
  async classify(input: string, context: ActionContext): Promise<ActionIntent> {
    const urgencyKeywords = {
      high: ['urgent', 'asap', 'immediately', 'now', 'quick'],
      medium: ['soon', 'important', 'needed'],
      low: ['later', 'eventually', 'someday']
    }
    
    const complexityKeywords = {
      simple: ['simple', 'basic', 'quick', 'easy'],
      moderate: ['detailed', 'thorough', 'comprehensive'],
      complex: ['complete', 'full', 'advanced', 'complex']
    }
    
    // Determine scope
    let scope: ActionIntent['scope'] = 'single'
    if (input.includes('board') || input.includes('all')) scope = 'board'
    if (input.includes('multiple') || /\d+/.test(input)) scope = 'multiple'
    
    // Determine urgency
    let urgency: ActionIntent['urgency'] = 'medium'
    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        urgency = level as ActionIntent['urgency']
        break
      }
    }
    
    // Determine complexity
    let complexity: ActionIntent['complexity'] = 'moderate'
    for (const [level, keywords] of Object.entries(complexityKeywords)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        complexity = level as ActionIntent['complexity']
        break
      }
    }
    
    return {
      primary: this.extractPrimaryIntent(input),
      scope,
      urgency,
      complexity
    }
  }
  
  private extractPrimaryIntent(input: string): string {
    // Simple intent extraction - can be enhanced with ML
    if (input.includes('create') || input.includes('make') || input.includes('add')) {
      return 'create'
    }
    if (input.includes('analyze') || input.includes('review')) {
      return 'analyze'
    }
    if (input.includes('organize') || input.includes('structure')) {
      return 'organize'
    }
    if (input.includes('plan') || input.includes('design')) {
      return 'plan'
    }
    if (input.includes('brainstorm') || input.includes('ideas')) {
      return 'brainstorm'
    }
    if (input.includes('research') || input.includes('investigate')) {
      return 'research'
    }
    return 'general'
  }
}

// 📊 PARAMETER EXTRACTOR
class ParameterExtractor {
  extract(input: string, intent: ActionIntent): ActionParameters {
    const parameters: ActionParameters = {}
    
    // Extract count
    const countMatch = input.match(/\b(\d+)\b/)
    if (countMatch) {
      parameters.count = parseInt(countMatch[1])
    }
    
    // Extract topic
    const topicMatch = input.match(/(?:about|for|on)\s+(.+?)(?:\s|$)/)
    if (topicMatch) {
      parameters.topic = topicMatch[1]
    }
    
    // Extract quoted instructions
    const quotedMatch = input.match(/"([^"]*)"/)
    if (quotedMatch) {
      parameters.customInstructions = quotedMatch[1]
    }
    
    // Extract style preferences
    const styleWords = ['simple', 'detailed', 'creative', 'professional', 'technical']
    const foundStyles = styleWords.filter(style => input.includes(style))
    if (foundStyles.length > 0) {
      parameters.style = foundStyles[0]
    }
    
    return parameters
  }
}

// 🏭 FACTORY FUNCTIONS
export function createActionDetectionEngine(): ActionDetectionEngine {
  return new ActionDetectionEngine()
}

export function createActionSequence(
  name: string,
  description: string,
  actions: DetectedAction[]
): ActionSequence {
  return {
    id: `sequence_${Date.now()}`,
    name,
    description,
    actions,
    estimatedTime: actions.length * 2, // 2 seconds per action
    complexity: actions.length > 5 ? 'complex' : actions.length > 2 ? 'moderate' : 'simple',
    dependencies: actions.flatMap(a => a.dependencies)
  }
}

// 🎯 MAIN EXPORT
export const actionDetectionEngine = createActionDetectionEngine() 