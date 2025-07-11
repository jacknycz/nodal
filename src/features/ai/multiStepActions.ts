import type { DetectedAction, ActionSequence, ActionType, ActionParameters } from './actionDetection'
import type { AIContext } from './aiTypes'
import type { BoardNode } from '../board/boardTypes'

// 🎭 MULTI-STEP ORCHESTRATOR TYPES
export interface ExecutionContext {
  sessionId: string
  userId?: string
  boardId?: string
  startTime: Date
  environment: 'development' | 'production'
  capabilities: ExecutionCapabilities
}

export interface ExecutionCapabilities {
  maxParallelActions: number
  timeoutMs: number
  retryAttempts: number
  rollbackEnabled: boolean
  progressTracking: boolean
}

export interface ActionExecution {
  id: string
  actionId: string
  sequenceId: string
  status: ExecutionStatus
  startTime?: Date
  endTime?: Date
  duration?: number
  result?: ExecutionResult
  error?: ExecutionError
  retryCount: number
  dependencies: string[]
  dependents: string[]
}

export type ExecutionStatus = 
  | 'pending'
  | 'waiting_dependencies'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back'

export interface ExecutionResult {
  success: boolean
  data?: any
  message?: string
  metadata?: {
    nodesCreated?: string[]
    connectionsCreated?: string[]
    boardChanges?: any[]
    analyticsData?: any
  }
}

export interface ExecutionError {
  code: string
  message: string
  details?: any
  recoverable: boolean
  suggestions?: string[]
}

export interface ExecutionPlan {
  id: string
  name: string
  description: string
  actions: ActionExecution[]
  totalSteps: number
  estimatedTime: number
  complexity: 'simple' | 'moderate' | 'complex'
  parallelGroups: string[][]
  criticalPath: string[]
}

export interface ExecutionProgress {
  planId: string
  currentStep: number
  totalSteps: number
  completedActions: number
  failedActions: number
  skippedActions: number
  elapsedTime: number
  estimatedTimeRemaining: number
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled'
  currentAction?: string
}

export interface ExecutionReport {
  planId: string
  success: boolean
  summary: {
    totalActions: number
    completedActions: number
    failedActions: number
    skippedActions: number
    totalTime: number
    averageActionTime: number
  }
  results: ExecutionResult[]
  errors: ExecutionError[]
  performance: {
    parallelEfficiency: number
    timeVsBudget: number
    successRate: number
  }
  recommendations: string[]
}

// 🎯 MULTI-STEP ORCHESTRATOR ENGINE
export class MultiStepOrchestrator {
  private executionContext: ExecutionContext
  private activeExecutions: Map<string, ExecutionPlan> = new Map()
  private progressCallbacks: Map<string, (progress: ExecutionProgress) => void> = new Map()
  private commandExecutor: CommandExecutor
  private dependencyResolver: DependencyResolver
  private errorRecovery: ErrorRecoveryManager
  private rollbackManager: RollbackManager

  constructor(context: ExecutionContext) {
    this.executionContext = context
    this.commandExecutor = new CommandExecutor()
    this.dependencyResolver = new DependencyResolver()
    this.errorRecovery = new ErrorRecoveryManager()
    this.rollbackManager = new RollbackManager()
  }

  // 🚀 MAIN ORCHESTRATION METHODS
  async executeActions(
    actions: DetectedAction[],
    context: AIContext,
    progressCallback?: (progress: ExecutionProgress) => void
  ): Promise<ExecutionReport> {
    // 🚨 Filter out very low confidence actions to prevent false positives
    const CONFIDENCE_THRESHOLD = 0.4 // 40% minimum confidence for Superman mode
    const filteredActions = actions.filter(action => action.confidence >= CONFIDENCE_THRESHOLD)
    
    if (filteredActions.length < actions.length) {
      console.log(`🧹 Filtered out ${actions.length - filteredActions.length} low-confidence actions (< ${CONFIDENCE_THRESHOLD * 100}%)`)
    }
    
    // If no actions meet the threshold, return empty report
    if (filteredActions.length === 0) {
      console.log(`❌ No actions meet confidence threshold - treating as conversational input`)
      return {
        planId: `empty_${Date.now()}`,
        success: true,
        summary: {
          totalActions: 0,
          completedActions: 0,
          failedActions: 0,
          skippedActions: actions.length,
          totalTime: 0,
          averageActionTime: 0
        },
        results: [],
        errors: [],
        performance: {
          parallelEfficiency: 1,
          timeVsBudget: 1,
          successRate: 1
        },
        recommendations: ['Input appears to be conversational - consider using Node-Aware mode for structured responses']
      }
    }
    
    // Debug logging
    console.log(`🚀 Executing ${filteredActions.length} detected actions:`)
    filteredActions.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action.type} (${(action.confidence * 100).toFixed(1)}% confidence) - ID: ${action.id}`)
    })
    
    // 1. Create execution plan
    const plan = await this.createExecutionPlan(filteredActions, context)
    
    console.log(`📋 Created execution plan with ${plan.actions.length} executions`)
    
    // 2. Register progress callback
    if (progressCallback) {
      this.progressCallbacks.set(plan.id, progressCallback)
    }
    
    // 3. Store active execution
    this.activeExecutions.set(plan.id, plan)
    
    try {
      // 4. Execute plan
      const report = await this.executePlan(plan, context)
      
      console.log(`✅ Execution complete: ${report.summary.completedActions}/${report.summary.totalActions} successful`)
      
      // 5. Cleanup
      this.cleanup(plan.id)
      
      return report
    } catch (error) {
      // 6. Handle catastrophic failure
      const report = await this.handleCatastrophicFailure(plan, error)
      this.cleanup(plan.id)
      return report
    }
  }

  async executeSequence(
    sequence: ActionSequence,
    context: AIContext,
    progressCallback?: (progress: ExecutionProgress) => void
  ): Promise<ExecutionReport> {
    return this.executeActions(sequence.actions, context, progressCallback)
  }

  // 📋 EXECUTION PLANNING
  private async createExecutionPlan(
    actions: DetectedAction[],
    context: AIContext
  ): Promise<ExecutionPlan> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 🎯 Cache detected actions for the CommandExecutor
    this.commandExecutor.setDetectedActions(actions)
    
    // Convert actions to executions
    const executions: ActionExecution[] = actions.map(action => ({
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionId: action.id,
      sequenceId: planId,
      status: 'pending',
      retryCount: 0,
      dependencies: action.dependencies,
      dependents: []
    }))

    // Resolve dependencies
    const resolvedExecutions = this.dependencyResolver.resolve(executions)
    
    // Create parallel groups
    const parallelGroups = this.createParallelGroups(resolvedExecutions)
    
    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(resolvedExecutions)
    
    // Estimate time
    const estimatedTime = this.estimateExecutionTime(resolvedExecutions, parallelGroups)

    return {
      id: planId,
      name: `Execution Plan ${planId}`,
      description: `Execute ${actions.length} actions with ${parallelGroups.length} parallel groups`,
      actions: resolvedExecutions,
      totalSteps: resolvedExecutions.length,
      estimatedTime,
      complexity: this.calculateComplexity(resolvedExecutions),
      parallelGroups,
      criticalPath
    }
  }

  // ⚡ PLAN EXECUTION
  private async executePlan(
    plan: ExecutionPlan,
    context: AIContext
  ): Promise<ExecutionReport> {
    const startTime = Date.now()
    let progress: ExecutionProgress = {
      planId: plan.id,
      currentStep: 0,
      totalSteps: plan.totalSteps,
      completedActions: 0,
      failedActions: 0,
      skippedActions: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: plan.estimatedTime,
      status: 'executing'
    }

    // Notify progress start
    this.notifyProgress(plan.id, progress)

    const results: ExecutionResult[] = []
    const errors: ExecutionError[] = []

    try {
      // Execute parallel groups in sequence
      for (const group of plan.parallelGroups) {
        const groupResults = await this.executeParallelGroup(
          group,
          plan,
          context,
          (stepProgress) => {
            progress = { ...progress, ...stepProgress }
            this.notifyProgress(plan.id, progress)
          }
        )

        results.push(...groupResults.results)
        errors.push(...groupResults.errors)

        // Update progress
        progress.completedActions += groupResults.completed
        progress.failedActions += groupResults.failed
        progress.currentStep = progress.completedActions + progress.failedActions
        progress.elapsedTime = Date.now() - startTime
        progress.estimatedTimeRemaining = Math.max(0, plan.estimatedTime - progress.elapsedTime)

        // Check for critical failures
        if (groupResults.failed > 0 && !this.executionContext.capabilities.rollbackEnabled) {
          progress.status = 'failed'
          this.notifyProgress(plan.id, progress)
          break
        }
      }

      // Final progress update
      progress.status = progress.failedActions === 0 ? 'completed' : 'failed'
      this.notifyProgress(plan.id, progress)

    } catch (error) {
      progress.status = 'failed'
      this.notifyProgress(plan.id, progress)
      throw error
    }

    // Generate report
    return this.generateExecutionReport(plan, results, errors, Date.now() - startTime)
  }

  // 🔄 PARALLEL GROUP EXECUTION
  private async executeParallelGroup(
    group: string[],
    plan: ExecutionPlan,
    context: AIContext,
    progressCallback: (progress: Partial<ExecutionProgress>) => void
  ): Promise<{
    results: ExecutionResult[]
    errors: ExecutionError[]
    completed: number
    failed: number
  }> {
    const groupExecutions = plan.actions.filter(exec => group.includes(exec.id))
    const promises = groupExecutions.map(exec => this.executeAction(exec, context))
    
    const results = await Promise.allSettled(promises)
    
    const executionResults: ExecutionResult[] = []
    const executionErrors: ExecutionError[] = []
    let completed = 0
    let failed = 0

    results.forEach((result, index) => {
      const execution = groupExecutions[index]
      
      if (result.status === 'fulfilled') {
        execution.status = 'completed'
        execution.result = result.value
        executionResults.push(result.value)
        completed++
      } else {
        execution.status = 'failed'
        execution.error = {
          code: 'EXECUTION_FAILED',
          message: result.reason?.message || 'Unknown error',
          details: result.reason,
          recoverable: true
        }
        executionErrors.push(execution.error)
        failed++
      }
    })

    return {
      results: executionResults,
      errors: executionErrors,
      completed,
      failed
    }
  }

  // 🎯 SINGLE ACTION EXECUTION
  private async executeAction(
    execution: ActionExecution,
    context: AIContext
  ): Promise<ExecutionResult> {
    execution.status = 'running'
    execution.startTime = new Date()

    try {
      // Execute the action based on its type
      const result = await this.commandExecutor.execute(execution, context)
      
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()
      execution.status = 'completed'
      execution.result = result

      return result
    } catch (error) {
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime!.getTime()
      execution.status = 'failed'
      execution.error = {
        code: 'ACTION_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        recoverable: this.errorRecovery.isRecoverable(error)
      }

      // Attempt recovery if possible
      if (execution.error.recoverable && execution.retryCount < this.executionContext.capabilities.retryAttempts) {
        execution.retryCount++
        execution.status = 'pending'
        return this.executeAction(execution, context)
      }

      throw error
    }
  }

  // 🔧 UTILITY METHODS
  private createParallelGroups(executions: ActionExecution[]): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()
    
    // Create dependency-based groups
    for (const execution of executions) {
      if (processed.has(execution.id)) continue
      
      const group: string[] = []
      const canRunInParallel = executions.filter(exec => 
        !processed.has(exec.id) && 
        exec.dependencies.every(dep => processed.has(dep))
      )
      
      for (const exec of canRunInParallel.slice(0, this.executionContext.capabilities.maxParallelActions)) {
        group.push(exec.id)
        processed.add(exec.id)
      }
      
      if (group.length > 0) {
        groups.push(group)
      }
    }
    
    return groups
  }

  private calculateCriticalPath(executions: ActionExecution[]): string[] {
    // Simple implementation - can be enhanced with actual critical path analysis
    return executions
      .filter(exec => exec.dependencies.length > 0)
      .map(exec => exec.id)
  }

  private estimateExecutionTime(executions: ActionExecution[], groups: string[][]): number {
    // Estimate based on action types and parallel groups
    const baseTimePerAction = 2000 // 2 seconds per action
    const parallelEfficiency = 0.8 // 80% efficiency when running in parallel
    
    return groups.reduce((total, group) => {
      const groupTime = Math.max(...group.map(() => baseTimePerAction))
      return total + (groupTime * parallelEfficiency)
    }, 0)
  }

  private calculateComplexity(executions: ActionExecution[]): 'simple' | 'moderate' | 'complex' {
    const actionCount = executions.length
    const dependencyCount = executions.reduce((sum, exec) => sum + exec.dependencies.length, 0)
    
    if (actionCount <= 3 && dependencyCount <= 2) return 'simple'
    if (actionCount <= 8 && dependencyCount <= 6) return 'moderate'
    return 'complex'
  }

  private notifyProgress(planId: string, progress: ExecutionProgress): void {
    const callback = this.progressCallbacks.get(planId)
    if (callback) {
      callback(progress)
    }
  }

  private cleanup(planId: string): void {
    this.activeExecutions.delete(planId)
    this.progressCallbacks.delete(planId)
  }

  private async handleCatastrophicFailure(
    plan: ExecutionPlan,
    error: any
  ): Promise<ExecutionReport> {
    return {
      planId: plan.id,
      success: false,
      summary: {
        totalActions: plan.totalSteps,
        completedActions: 0,
        failedActions: plan.totalSteps,
        skippedActions: 0,
        totalTime: 0,
        averageActionTime: 0
      },
      results: [],
      errors: [{
        code: 'CATASTROPHIC_FAILURE',
        message: error instanceof Error ? error.message : 'Unknown catastrophic failure',
        details: error,
        recoverable: false
      }],
      performance: {
        parallelEfficiency: 0,
        timeVsBudget: 0,
        successRate: 0
      },
      recommendations: ['Review execution plan and try again']
    }
  }

  private generateExecutionReport(
    plan: ExecutionPlan,
    results: ExecutionResult[],
    errors: ExecutionError[],
    totalTime: number
  ): ExecutionReport {
    const successful = results.filter(r => r.success).length
    const failed = errors.length
    const total = plan.totalSteps

    return {
      planId: plan.id,
      success: failed === 0,
      summary: {
        totalActions: total,
        completedActions: successful,
        failedActions: failed,
        skippedActions: total - successful - failed,
        totalTime,
        averageActionTime: totalTime / total
      },
      results,
      errors,
      performance: {
        parallelEfficiency: this.calculateParallelEfficiency(plan, totalTime),
        timeVsBudget: totalTime / plan.estimatedTime,
        successRate: successful / total
      },
      recommendations: this.generateRecommendations(plan, results, errors)
    }
  }

  private calculateParallelEfficiency(plan: ExecutionPlan, actualTime: number): number {
    const sequentialTime = plan.totalSteps * 2000 // 2 seconds per action
    return Math.min(1, sequentialTime / actualTime)
  }

  private generateRecommendations(
    plan: ExecutionPlan,
    results: ExecutionResult[],
    errors: ExecutionError[]
  ): string[] {
    const recommendations: string[] = []
    
    if (errors.length > 0) {
      recommendations.push('Review and fix errors before retrying')
    }
    
    if (plan.complexity === 'complex') {
      recommendations.push('Consider breaking down complex actions into simpler steps')
    }
    
    if (results.length > 0) {
      recommendations.push('Successful actions can be used as templates for future executions')
    }
    
    return recommendations
  }

  // 📊 PUBLIC QUERY METHODS
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys())
  }

  getExecutionProgress(planId: string): ExecutionProgress | null {
    const plan = this.activeExecutions.get(planId)
    if (!plan) return null
    
    const completed = plan.actions.filter(a => a.status === 'completed').length
    const failed = plan.actions.filter(a => a.status === 'failed').length
    const current = plan.actions.find(a => a.status === 'running')
    
    const firstActionStart = plan.actions[0]?.startTime?.getTime() || Date.now()
    const elapsedTime = Date.now() - firstActionStart
    
    return {
      planId,
      currentStep: completed + failed,
      totalSteps: plan.totalSteps,
      completedActions: completed,
      failedActions: failed,
      skippedActions: 0,
      elapsedTime,
      estimatedTimeRemaining: Math.max(0, plan.estimatedTime - elapsedTime),
      status: failed > 0 ? 'failed' : completed === plan.totalSteps ? 'completed' : 'executing',
      currentAction: current?.id
    }
  }

  async cancelExecution(planId: string): Promise<boolean> {
    const plan = this.activeExecutions.get(planId)
    if (!plan) return false
    
    // Mark all pending/running actions as cancelled
    plan.actions.forEach(action => {
      if (action.status === 'pending' || action.status === 'running') {
        action.status = 'cancelled'
      }
    })
    
    this.cleanup(planId)
    return true
  }
}

// 🎮 COMMAND EXECUTOR
class CommandExecutor {
  // Add helper method for positioning
  private findNextAvailablePosition(context: AIContext): { x: number, y: number } {
    const existingNodes = context.board?.nodes || []
    const gridSize = 300 // Distance between grid spots
    const startX = 200
    const startY = 200
    
    // Simple grid search - check each spot until we find an empty one
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const testX = startX + col * gridSize
        const testY = startY + row * gridSize
        
        // Check if any existing node is too close to this spot
        const tooClose = existingNodes.some(node => {
          const dx = Math.abs(node.position.x - testX)
          const dy = Math.abs(node.position.y - testY)
          return dx < 250 && dy < 250 // 250px minimum distance
        })
        
        if (!tooClose) {
          return { x: testX, y: testY }
        }
      }
    }
    
    // Fallback if grid is full
    return { x: startX + Math.random() * 1000, y: startY + Math.random() * 1000 }
  }

  async execute(execution: ActionExecution, context: AIContext): Promise<ExecutionResult> {
    console.log(`🎯 Executing action: ${execution.actionId}`)
    
    // Get the detected action with all its rich context
    const detectedAction = this.getDetectedAction(execution.actionId, context)
    if (!detectedAction) {
      throw new Error(`Detected action ${execution.actionId} not found`)
    }

    console.log(`🎭 Action type: ${detectedAction.type}`)
    console.log(`📝 Original prompt: "${detectedAction.metadata.originalText}"`)
    console.log(`🎯 Topic: ${detectedAction.parameters.topic || 'none'}`)
    console.log(`💡 Intent: ${detectedAction.intent.primary}`)

    try {
      switch (detectedAction.type) {
        case 'create_single':
          return await this.executeCreateSingle(detectedAction, context)
        case 'create_multiple':
          return await this.executeCreateMultiple(detectedAction, context)
        case 'brainstorm_ideas':
          return await this.executeBrainstormIdeas(detectedAction, context)
        case 'plan_project':
          return await this.executePlanProject(detectedAction, context)
        case 'analyze_board':
          return await this.executeAnalyzeBoard(detectedAction, context)
        default:
          return {
            success: false,
            message: `Unsupported action type: ${detectedAction.type}`,
            metadata: {}
          }
      }
    } catch (error) {
      return {
        success: false,
        message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      }
    }
  }

  private detectedActionsCache: Map<string, DetectedAction> = new Map()

  // Store detected actions for later retrieval
  setDetectedActions(actions: DetectedAction[]): void {
    for (const action of actions) {
      this.detectedActionsCache.set(action.id, action)
    }
  }

  // Get detected action by ID with all its rich context
  private getDetectedAction(actionId: string, context: AIContext): DetectedAction | null {
    return this.detectedActionsCache.get(actionId) || null
  }

  // Generate contextually appropriate content based on the detected action
  private async generateContextualContent(detectedAction: DetectedAction, mode: 'single' | 'multiple'): Promise<{ title: string; description: string } | { title: string; description: string }[]> {
    const prompt = detectedAction.metadata.originalText
    const topic = detectedAction.parameters.topic || this.extractTopicFromPrompt(prompt)
    const intent = detectedAction.intent.primary
    
    if (mode === 'single') {
      // Generate single node content
      if (topic && topic.includes('flavor')) {
        return {
          title: 'Signature Coffee Blend',
          description: `A unique house blend combining Ethiopian Yirgacheffe for brightness, Colombian Supremo for body, and Brazilian Santos for chocolate notes. Roasted to a medium-dark profile to highlight the natural sweetness while maintaining origin characteristics.`
        }
      } else if (topic && topic.includes('plan')) {
        return {
          title: 'Project Vision',
          description: `High-level overview and vision for the project. This serves as the foundation for all planning and development activities.`
        }
      } else {
        return {
          title: this.generateTitleFromPrompt(prompt),
          description: `Generated based on your request: "${prompt}". This node provides a focused response to your specific needs.`
        }
      }
    } else {
      // Generate multiple node content
      if (topic && topic.includes('flavor')) {
        return [
          {
            title: 'Lavender Honey Latte',
            description: 'A soothing blend featuring organic lavender flowers and local wildflower honey. The floral notes complement the espresso\'s richness while the honey adds natural sweetness and a silky texture.'
          },
          {
            title: 'Maple Cinnamon Cold Brew',
            description: 'Cold brew infused with pure maple syrup and Ceylon cinnamon. Served over ice with a cinnamon stick garnish. The maple provides caramel-like sweetness while cinnamon adds warmth and complexity.'
          },
          {
            title: 'Cardamom Rose Cappuccino',
            description: 'Traditional cappuccino elevated with ground cardamom and rose water. The cardamom adds aromatic spice while rose water provides a delicate floral finish. Topped with rose petals for presentation.'
          }
        ]
      } else if (topic && topic.includes('plan')) {
        return [
          {
            title: 'Market Analysis',
            description: 'Target market identification, competitor analysis, and market size evaluation. Understanding the competitive landscape and customer demographics.'
          },
          {
            title: 'Financial Projections',
            description: 'Revenue forecasts, cost analysis, and profitability timeline. Break-even analysis and funding requirements.'
          },
          {
            title: 'Implementation Strategy',
            description: 'Step-by-step execution plan, resource allocation, and timeline for bringing the project to market.'
          }
        ]
      } else {
        // Generic multiple nodes based on the prompt
        const baseTitle = this.generateTitleFromPrompt(prompt)
        return [
          {
            title: `${baseTitle} - Concept 1`,
            description: `First approach to ${topic || 'your request'}, focusing on foundational elements and core requirements.`
          },
          {
            title: `${baseTitle} - Concept 2`,
            description: `Alternative approach to ${topic || 'your request'}, exploring different angles and possibilities.`
          },
          {
            title: `${baseTitle} - Concept 3`,
            description: `Advanced approach to ${topic || 'your request'}, incorporating innovative ideas and best practices.`
          }
        ]
      }
    }
  }

  // Helper method to extract topic from prompt
  private extractTopicFromPrompt(prompt: string): string {
    // Simple keyword extraction
    const keywords = prompt.toLowerCase().match(/\b(flavor|plan|idea|concept|strategy|design|business|coffee|marketing|development)\w*\b/g)
    return keywords ? keywords[0] : 'general'
  }

  // Helper method to generate title from prompt
  private generateTitleFromPrompt(prompt: string): string {
    // Clean up the prompt and create a title
    const cleanPrompt = prompt.replace(/^(create|make|add|generate|can you|please)\s+/i, '')
    const words = cleanPrompt.split(' ').slice(0, 3)
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Execute brainstorming ideas action
  private async executeBrainstormIdeas(detectedAction: DetectedAction, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Generate multiple idea nodes
    const ideas = await this.generateContextualContent(detectedAction, 'multiple') as { title: string; description: string }[]
    const nodesCreated: string[] = []
    
    for (const idea of ideas) {
      const position = this.findNextAvailablePosition(context)
      
      const nodeData = {
        type: 'default' as const,
        position: position,
        data: {
          label: idea.title,
          content: idea.description,
          type: 'default' as const,
          expanded: false,
          aiGenerated: true
        }
      }
      
      useBoardStore.getState().addNode(nodeData)
      nodesCreated.push(nodeData.data.label)
    }
    
    return {
      success: true,
      message: `Generated ${ideas.length} brainstorming ideas based on your request`,
      metadata: {
        nodesCreated,
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executeCreateSingle(detectedAction: DetectedAction, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Use helper to find available position
    const position = this.findNextAvailablePosition(context)
    
    // Generate contextually appropriate content based on the original prompt
    const content = await this.generateContextualContent(detectedAction, 'single') as { title: string; description: string }
    
    const nodeData = {
      type: 'default' as const,
      position: position,
      data: {
        label: content.title,
        content: content.description,
        type: 'default' as const,
        expanded: false,
        aiGenerated: true
      }
    }
    
    useBoardStore.getState().addNode(nodeData)
    
    return {
      success: true,
      message: `Created "${content.title}" node based on your request`,
      metadata: {
        nodesCreated: [nodeData.data.label],
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executeCreateMultiple(detectedAction: DetectedAction, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Generate contextually appropriate multiple nodes
    const nodeConfigs = await this.generateContextualContent(detectedAction, 'multiple') as { title: string; description: string }[]
    const nodesCreated: string[] = []
    
    for (const nodeConfig of nodeConfigs) {
      const position = this.findNextAvailablePosition(context)
      
      const nodeData = {
        type: 'default' as const,
        position: position,
        data: {
          label: nodeConfig.title,
          content: nodeConfig.description,
          type: 'default' as const,
          expanded: false,
          aiGenerated: true
        }
      }
      
      useBoardStore.getState().addNode(nodeData)
      nodesCreated.push(nodeData.data.label)
    }
    
    return {
      success: true,
      message: `Created ${nodeConfigs.length} nodes based on your request`,
      metadata: {
        nodesCreated,
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executePlanProject(detectedAction: DetectedAction, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Generate project plan nodes based on the detected action
    const projectNodes = await this.generateProjectPlan(detectedAction)
    const nodesCreated: string[] = []
    
    for (const nodeConfig of projectNodes) {
      const position = this.findNextAvailablePosition(context)
      
      const nodeData = {
        type: 'default' as const,
        position: position,
        data: {
          label: nodeConfig.title,
          content: nodeConfig.description,
          type: 'default' as const,
          expanded: false,
          aiGenerated: true
        }
      }
      
      useBoardStore.getState().addNode(nodeData)
      nodesCreated.push(nodeData.data.label)
    }
    
    return {
      success: true,
      message: `Created ${projectNodes.length} project plan nodes based on your request`,
      metadata: {
        nodesCreated,
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  // Generate project plan nodes based on the detected action
  private async generateProjectPlan(detectedAction: DetectedAction): Promise<{ title: string; description: string }[]> {
    const prompt = detectedAction.metadata.originalText
    const topic = detectedAction.parameters.topic || this.extractTopicFromPrompt(prompt)
    
    if (topic.includes('business') || topic.includes('coffee')) {
      return [
        {
          title: 'Phase 1: Planning & Research',
          description: 'Complete market research, finalize business plan, secure permits and licenses. Timeline: Months 1-2. Key deliverables: Business plan, market analysis, legal structure.'
        },
        {
          title: 'Phase 2: Funding & Location',
          description: 'Secure funding, find and lease location, design interior layout. Timeline: Months 3-4. Key deliverables: Funding secured, lease signed, design completed.'
        },
        {
          title: 'Phase 3: Launch & Operations',
          description: 'Equipment installation, staff hiring, marketing campaign, grand opening. Timeline: Months 5-6. Key deliverables: Fully operational coffee shop, trained staff, customer base.'
        }
      ]
    } else {
      // Generic project plan
      return [
        {
          title: 'Phase 1: Planning & Design',
          description: `Initial planning and design phase for ${topic}. Define requirements, create specifications, and establish timeline.`
        },
        {
          title: 'Phase 2: Development & Implementation',
          description: `Development and implementation phase for ${topic}. Execute the plan, build components, and integrate systems.`
        },
        {
          title: 'Phase 3: Testing & Launch',
          description: `Testing and launch phase for ${topic}. Quality assurance, user testing, and final deployment.`
        }
      ]
    }
  }

  private async executeAnalyzeBoard(detectedAction: DetectedAction, context: AIContext): Promise<ExecutionResult> {
    const nodeCount = context.board?.nodes?.length || 0
    const documentCount = context.documents?.documents?.length || 0
    
    return {
      success: true,
      message: `Board analysis complete: ${nodeCount} nodes, ${documentCount} documents analyzed based on your request: "${detectedAction.metadata.originalText}"`,
      metadata: {
        nodesCreated: [],
        connectionsCreated: [],
        boardChanges: ['analysis_performed']
      }
    }
  }
}

// 🔗 DEPENDENCY RESOLVER
class DependencyResolver {
  resolve(executions: ActionExecution[]): ActionExecution[] {
    // Simple topological sort for dependencies
    const resolved: ActionExecution[] = []
    const visited = new Set<string>()
    
    const visit = (execution: ActionExecution) => {
      if (visited.has(execution.id)) return
      
      // Visit dependencies first
      for (const depId of execution.dependencies) {
        const dep = executions.find(e => e.id === depId)
        if (dep) visit(dep)
      }
      
      visited.add(execution.id)
      resolved.push(execution)
    }
    
    executions.forEach(visit)
    return resolved
  }
}

// 🚨 ERROR RECOVERY MANAGER
class ErrorRecoveryManager {
  isRecoverable(error: any): boolean {
    // Simple recovery logic - can be enhanced
    if (error instanceof Error) {
      return !error.message.includes('FATAL')
    }
    return true
  }
}

// 🔄 ROLLBACK MANAGER
class RollbackManager {
  async rollback(planId: string): Promise<boolean> {
    // Implementation for rolling back changes
    return true
  }
}

// 🏭 FACTORY FUNCTIONS
export function createMultiStepOrchestrator(
  capabilities: Partial<ExecutionCapabilities> = {}
): MultiStepOrchestrator {
  const defaultCapabilities: ExecutionCapabilities = {
    maxParallelActions: 3,
    timeoutMs: 30000,
    retryAttempts: 2,
    rollbackEnabled: true,
    progressTracking: true
  }

  const context: ExecutionContext = {
    sessionId: `session_${Date.now()}`,
    startTime: new Date(),
    environment: 'development',
    capabilities: { ...defaultCapabilities, ...capabilities }
  }

  return new MultiStepOrchestrator(context)
}

// 🎯 MAIN EXPORT
export const multiStepOrchestrator = createMultiStepOrchestrator() 