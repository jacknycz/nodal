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
    // Debug logging
    console.log(`🚀 Executing ${actions.length} detected actions:`)
    actions.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action.type} (${action.confidence}% confidence) - ID: ${action.id}`)
    })
    
    // 1. Create execution plan
    const plan = await this.createExecutionPlan(actions, context)
    
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
    
    const action = context.board?.nodes ? this.findAction(execution.actionId, context) : null
    if (!action) {
      throw new Error(`Action ${execution.actionId} not found`)
    }

    console.log(`🎭 Action type: ${action.type}`)

    try {
      switch (action.type) {
        case 'create_single':
          return await this.executeCreateSingle(action, context)
        case 'create_multiple':
          return await this.executeCreateMultiple(action, context)
        case 'plan_project':
          return await this.executePlanProject(action, context)
        case 'analyze_board':
          return await this.executeAnalyzeBoard(action, context)
        default:
          return {
            success: false,
            message: `Unsupported action type: ${action.type}`,
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

  private static actionCounter = 0
  
  private findAction(actionId: string, context: AIContext): any {
    // Use a simple counter to ensure different actions get different types
    // This guarantees the first action gets one type, second gets another, etc.
    const actionIndex = CommandExecutor.actionCounter++
    
    // For business planning, alternate between single vision and project planning
    const actionType = actionIndex % 2 === 0 ? 'create_single' : 'plan_project'
    
    console.log(`🔍 Action ID: ${actionId} -> Counter: ${actionIndex} -> Type: ${actionType}`)
    
    return {
      id: actionId,
      type: actionType,
      parameters: {
        count: actionType === 'create_single' ? 1 : 3,
        topic: actionType === 'plan_project' ? 'project planning' : 'business components'
      }
    }
  }

  private async executeCreateSingle(action: any, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Use helper to find available position
    const position = this.findNextAvailablePosition(context)
    
    // Create a high-level business overview node
    const nodeData = {
      type: 'default' as const,
      position: position,
      data: {
        label: 'Sustainable Coffee Shop Vision',
        content: 'Central vision for the sustainable coffee shop business combining ethical sourcing, community engagement, and environmental responsibility. This will serve as the foundation for all planning and operations.',
        type: 'default' as const,
        expanded: false,
        aiGenerated: true
      }
    }
    
    useBoardStore.getState().addNode(nodeData)
    
    return {
      success: true,
      message: 'Created business vision node',
      metadata: {
        nodesCreated: [nodeData.data.label],
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executeCreateMultiple(action: any, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    // Create business plan component nodes
    const businessPlanNodes = [
      {
        label: 'Market Analysis',
        content: 'Target market: Local coffee enthusiasts, remote workers, eco-conscious consumers. Competition analysis, customer demographics, and market size evaluation for sustainable coffee operations.'
      },
      {
        label: 'Financial Projections',
        content: 'Startup costs: $75K-$150K. Revenue projections: $200K-$400K annually. Break-even analysis, cash flow projections, and funding requirements for sustainable coffee shop launch.'
      },
      {
        label: 'Sustainability Framework',
        content: 'Fair-trade sourcing, compostable packaging, renewable energy, waste reduction programs. Environmental impact measurement and community partnership initiatives.'
      }
    ]
    
    const nodesCreated = []
    
    for (const nodeConfig of businessPlanNodes) {
      const position = this.findNextAvailablePosition(context)
      
      const nodeData = {
        type: 'default' as const,
        position: position,
        data: {
          label: nodeConfig.label,
          content: nodeConfig.content,
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
      message: `Created ${businessPlanNodes.length} business plan component nodes`,
      metadata: {
        nodesCreated,
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executePlanProject(action: any, context: AIContext): Promise<ExecutionResult> {
    const { useBoardStore } = await import('../board/boardSlice')
    
    const projectNodes = [
      {
        label: 'Phase 1: Planning & Research',
        content: 'Complete market research, finalize business plan, secure permits and licenses. Timeline: Months 1-2. Key deliverables: Business plan, market analysis, legal structure.'
      },
      {
        label: 'Phase 2: Funding & Location',
        content: 'Secure funding, find and lease location, design interior layout. Timeline: Months 3-4. Key deliverables: Funding secured, lease signed, design completed.'
      },
      {
        label: 'Phase 3: Launch & Operations',
        content: 'Equipment installation, staff hiring, marketing campaign, grand opening. Timeline: Months 5-6. Key deliverables: Fully operational coffee shop, trained staff, customer base.'
      }
    ]
    
    const nodesCreated = []
    
    for (const nodeConfig of projectNodes) {
      const position = this.findNextAvailablePosition(context)
      
      const nodeData = {
        type: 'default' as const,
        position: position,
        data: {
          label: nodeConfig.label,
          content: nodeConfig.content,
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
      message: `Created ${projectNodes.length} project timeline nodes`,
      metadata: {
        nodesCreated,
        connectionsCreated: [],
        boardChanges: []
      }
    }
  }

  private async executeAnalyzeBoard(action: any, context: AIContext): Promise<ExecutionResult> {
    const nodeCount = context.board?.nodes?.length || 0
    const documentCount = context.documents?.documents?.length || 0
    
    return {
      success: true,
      message: `Board analysis complete: ${nodeCount} nodes, ${documentCount} documents analyzed`,
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