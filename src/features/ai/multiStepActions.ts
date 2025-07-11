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
    // 1. Create execution plan
    const plan = await this.createExecutionPlan(actions, context)
    
    // 2. Register progress callback
    if (progressCallback) {
      this.progressCallbacks.set(plan.id, progressCallback)
    }
    
    // 3. Store active execution
    this.activeExecutions.set(plan.id, plan)
    
    try {
      // 4. Execute plan
      const report = await this.executePlan(plan, context)
      
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
  async execute(execution: ActionExecution, context: AIContext): Promise<ExecutionResult> {
    // This would integrate with the existing chat command system
    // For now, return a mock result
    return {
      success: true,
      message: `Executed action ${execution.actionId}`,
      metadata: {
        nodesCreated: [`node_${execution.actionId}`],
        connectionsCreated: [],
        boardChanges: []
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