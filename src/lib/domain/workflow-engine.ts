/**
 * Workflow Engine
 * Enterprise workflow management with state machines and process orchestration
 */

import { logger } from '../logger';
import { BusinessError } from '../errors';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'action' | 'condition' | 'approval' | 'notification' | 'delay';
  config: any;
  retryable: boolean;
  timeout?: number;
  onSuccess?: string; // Next step ID
  onFailure?: string; // Failure step ID
  onTimeout?: string; // Timeout step ID
  metadata?: Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  initialStep: string;
  steps: Map<string, WorkflowStep>;
  globalTimeout?: number;
  maxRetries?: number;
  metadata: {
    category: string;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
  };
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStep: string;
  context: WorkflowContext;
  history: WorkflowEvent[];
  startTime: Date;
  endTime?: Date;
  error?: WorkflowError;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface WorkflowContext {
  data: Record<string, any>;
  variables: Record<string, any>;
  userId?: string;
  correlationId?: string;
  parentWorkflowId?: string;
}

export interface WorkflowEvent {
  id: string;
  workflowInstanceId: string;
  stepId: string;
  type: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'workflow_paused' | 'workflow_resumed';
  timestamp: Date;
  duration?: number;
  result?: any;
  error?: WorkflowError;
  metadata?: Record<string, any>;
}

export interface WorkflowError {
  code: string;
  message: string;
  stepId: string;
  retryable: boolean;
  details?: any;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Enterprise workflow execution engine
 */
export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows = new Map<string, WorkflowDefinition>();
  private instances = new Map<string, WorkflowInstance>();
  private stepHandlers = new Map<string, Function>();
  private eventListeners = new Map<string, Function[]>();

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  constructor() {
    this.initializeStepHandlers();
    this.startCleanupTimer();
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);

    logger.info('Workflow registered', {
      workflowId: definition.id,
      name: definition.name,
      stepCount: definition.steps.size,
    });
  }

  /**
   * Start a workflow instance
   */
  async startWorkflow(
    workflowId: string,
    context: WorkflowContext
  ): Promise<WorkflowInstance> {
    const definition = this.workflows.get(workflowId);
    if (!definition) {
      throw new BusinessError(
        `Workflow not found: ${workflowId}`,
        'WORKFLOW_NOT_FOUND'
      );
    }

    const instance: WorkflowInstance = {
      id: this.generateInstanceId(),
      workflowId,
      status: 'pending',
      currentStep: definition.initialStep,
      context,
      history: [],
      startTime: new Date(),
      retryCount: 0,
      metadata: {},
    };

    this.instances.set(instance.id, instance);

    logger.info('Workflow started', {
      workflowId,
      instanceId: instance.id,
      correlationId: context.correlationId,
      userId: context.userId,
    });

    // Start execution asynchronously
    setImmediate(() => this.executeWorkflow(instance.id));

    return instance;
  }

  /**
   * Execute a workflow instance
   */
  async executeWorkflow(instanceId: string): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new BusinessError(`Workflow instance not found: ${instanceId}`, 'INSTANCE_NOT_FOUND');
    }

    const definition = this.workflows.get(instance.workflowId);
    if (!definition) {
      throw new BusinessError(`Workflow definition not found: ${instance.workflowId}`, 'WORKFLOW_NOT_FOUND');
    }

    instance.status = 'running';

    try {
      while (instance.status === 'running' && instance.currentStep) {
        const step = definition.steps.get(instance.currentStep);
        if (!step) {
          throw new BusinessError(
            `Step not found: ${instance.currentStep}`,
            'STEP_NOT_FOUND'
          );
        }

        const stepResult = await this.executeStep(instance, step, definition);

        if (stepResult.success) {
          // Move to next step
          instance.currentStep = step.onSuccess || '';

          if (!instance.currentStep) {
            // Workflow completed
            instance.status = 'completed';
            instance.endTime = new Date();
            break;
          }
        } else {
          // Handle step failure
          if (step.retryable && instance.retryCount < (definition.maxRetries || 3)) {
            instance.retryCount++;
            logger.info('Retrying workflow step', {
              instanceId,
              stepId: step.id,
              retryCount: instance.retryCount,
            });
            continue;
          }

          // Move to failure step or fail workflow
          if (step.onFailure) {
            instance.currentStep = step.onFailure;
          } else {
            instance.status = 'failed';
            instance.endTime = new Date();
            instance.error = stepResult.error;
            break;
          }
        }
      }

      this.emitEvent('workflow_completed', {
        instanceId,
        status: instance.status,
        duration: instance.endTime ? instance.endTime.getTime() - instance.startTime.getTime() : undefined,
      });

      return instance;
    } catch (error) {
      instance.status = 'failed';
      instance.endTime = new Date();
      instance.error = {
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: (error as Error).message,
        stepId: instance.currentStep,
        retryable: false,
      };

      logger.error('Workflow execution failed', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
        workflowId: instance.workflowId,
        currentStep: instance.currentStep,
      });

      return instance;
    }
  }

  /**
   * Pause a workflow instance
   */
  async pauseWorkflow(instanceId: string, reason?: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'running') {
      return false;
    }

    instance.status = 'paused';

    this.addEventToHistory(instance, {
      type: 'workflow_paused',
      stepId: instance.currentStep,
      metadata: { reason },
    });

    logger.info('Workflow paused', { instanceId, reason });
    return true;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'paused') {
      return false;
    }

    instance.status = 'running';

    this.addEventToHistory(instance, {
      type: 'workflow_resumed',
      stepId: instance.currentStep,
    });

    logger.info('Workflow resumed', { instanceId });

    // Continue execution
    setImmediate(() => this.executeWorkflow(instanceId));

    return true;
  }

  /**
   * Cancel a workflow instance
   */
  async cancelWorkflow(instanceId: string, reason?: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status === 'completed') {
      return false;
    }

    instance.status = 'cancelled';
    instance.endTime = new Date();

    logger.info('Workflow cancelled', { instanceId, reason });
    return true;
  }

  /**
   * Get workflow instance status
   */
  getWorkflowStatus(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all active workflow instances
   */
  getActiveWorkflows(): WorkflowInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.status === 'running' || instance.status === 'paused'
    );
  }

  // Private helper methods

  private async executeStep(
    instance: WorkflowInstance,
    step: WorkflowStep,
    _definition: WorkflowDefinition
  ): Promise<{ success: boolean; result?: any; error?: WorkflowError }> {
    const startTime = Date.now();

    this.addEventToHistory(instance, {
      type: 'step_started',
      stepId: step.id,
    });

    try {
      const handler = this.stepHandlers.get(step.type);
      if (!handler) {
        throw new Error(`No handler found for step type: ${step.type}`);
      }

      const result = await handler(step, instance.context);
      const duration = Date.now() - startTime;

      this.addEventToHistory(instance, {
        type: 'step_completed',
        stepId: step.id,
        duration,
        result,
      });

      return { success: true, result };
    } catch (error) {
      const duration = Date.now() - startTime;

      const workflowError: WorkflowError = {
        code: 'STEP_EXECUTION_FAILED',
        message: (error as Error).message,
        stepId: step.id,
        retryable: step.retryable,
      };

      this.addEventToHistory(instance, {
        type: 'step_failed',
        stepId: step.id,
        duration,
        error: workflowError,
      });

      return { success: false, error: workflowError };
    }
  }

  private initializeStepHandlers(): void {
    // Action step handler
    this.stepHandlers.set('action', async (step: WorkflowStep, context: WorkflowContext) => {
      const { actionType, params } = step.config;

      switch (actionType) {
        case 'create_booking':
          return this.handleCreateBooking(params, context);

        case 'process_payment':
          return this.handleProcessPayment(params, context);

        case 'send_notification':
          return this.handleSendNotification(params, context);

        case 'assign_resources':
          return this.handleAssignResources(params, context);

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
    });

    // Condition step handler
    this.stepHandlers.set('condition', async (step: WorkflowStep, context: WorkflowContext) => {
      const { conditionType, expression } = step.config;

      return this.evaluateCondition(conditionType, expression, context);
    });

    // Approval step handler
    this.stepHandlers.set('approval', async (_step: WorkflowStep, _context: WorkflowContext) => {
      // In production, this would integrate with approval systems
      return { approved: true, approver: 'system' };
    });

    // Notification step handler
    this.stepHandlers.set('notification', async (step: WorkflowStep, context: WorkflowContext) => {
      const { notificationType, recipient, template } = step.config;

      logger.info('Sending workflow notification', {
        type: notificationType,
        recipient,
        template,
        correlationId: context.correlationId,
      });

      return { sent: true, notificationType };
    });

    // Delay step handler
    this.stepHandlers.set('delay', async (step: WorkflowStep, _context: WorkflowContext) => {
      const { delayMs } = step.config;

      await new Promise(resolve => setTimeout(resolve, delayMs));
      return { delayed: delayMs };
    });
  }

  // Mock implementations for demo purposes
  private async handleCreateBooking(params: any, context: WorkflowContext): Promise<any> {
    logger.info('Creating booking', { params, correlationId: context.correlationId });
    return { bookingId: Date.now(), created: true };
  }

  private async handleProcessPayment(params: any, context: WorkflowContext): Promise<any> {
    logger.info('Processing payment', { params, correlationId: context.correlationId });
    return { paymentId: `pi_${Date.now()}`, status: 'succeeded' };
  }

  private async handleSendNotification(params: any, context: WorkflowContext): Promise<any> {
    logger.info('Sending notification', { params, correlationId: context.correlationId });
    return { notificationId: `notif_${Date.now()}`, sent: true };
  }

  private async handleAssignResources(params: any, context: WorkflowContext): Promise<any> {
    logger.info('Assigning resources', { params, correlationId: context.correlationId });
    return { staffId: 1, bayId: 2, assigned: true };
  }

  private async evaluateCondition(
    type: string,
    expression: any,
    context: WorkflowContext
  ): Promise<boolean> {
    // Simple condition evaluation - would be enhanced in production
    switch (type) {
      case 'field_equals':
        return context.data[expression.field] === expression.value;

      case 'field_exists':
        return expression.field in context.data;

      case 'custom':
        // Evaluate custom expressions
        return true;

      default:
        return false;
    }
  }

  private addEventToHistory(instance: WorkflowInstance, event: Partial<WorkflowEvent>): void {
    const workflowEvent: WorkflowEvent = {
      id: this.generateEventId(),
      workflowInstanceId: instance.id,
      stepId: event.stepId || instance.currentStep,
      type: event.type!,
      timestamp: new Date(),
      duration: event.duration,
      result: event.result,
      error: event.error,
      metadata: event.metadata,
    };

    instance.history.push(workflowEvent);

    // Keep history size manageable
    if (instance.history.length > 1000) {
      instance.history = instance.history.slice(-500);
    }
  }

  private generateInstanceId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private emitEvent(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        logger.error('Event listener error', {
          error: error instanceof Error ? error.message : String(error),
          eventType
        });
      }
    });
  }

  private startCleanupTimer(): void {
    // Clean up completed workflows older than 24 hours
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDelete: string[] = [];

      for (const [id, instance] of this.instances) {
        if (
          instance.status === 'completed' ||
          instance.status === 'failed' ||
          instance.status === 'cancelled'
        ) {
          if (instance.endTime && instance.endTime < cutoff) {
            toDelete.push(id);
          }
        }
      }

      toDelete.forEach(id => this.instances.delete(id));

      if (toDelete.length > 0) {
        logger.info('Cleaned up completed workflows', { count: toDelete.length });
      }
    }, 3600000); // Every hour
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, listener: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Get workflow metrics
   */
  getWorkflowMetrics(): {
    totalWorkflows: number;
    activeInstances: number;
    completedToday: number;
    failedToday: number;
    averageExecutionTime: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const allInstances = Array.from(this.instances.values());
    const todayInstances = allInstances.filter(
      instance => instance.startTime >= todayStart
    );

    const completedInstances = todayInstances.filter(
      instance => instance.status === 'completed' && instance.endTime
    );

    const failedInstances = todayInstances.filter(
      instance => instance.status === 'failed'
    );

    const avgExecutionTime = completedInstances.length > 0 ?
      completedInstances.reduce((sum, instance) =>
        sum + (instance.endTime!.getTime() - instance.startTime.getTime()), 0
      ) / completedInstances.length : 0;

    const failureReasons = new Map<string, number>();
    failedInstances.forEach(instance => {
      if (instance.error) {
        const reason = instance.error.code;
        failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
      }
    });

    const topFailureReasons = Array.from(failureReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalWorkflows: this.workflows.size,
      activeInstances: allInstances.filter(i => i.status === 'running' || i.status === 'paused').length,
      completedToday: completedInstances.length,
      failedToday: failedInstances.length,
      averageExecutionTime: avgExecutionTime,
      topFailureReasons,
    };
  }
}

/**
 * Pre-defined booking workflows
 */
export function createBookingWorkflows(): void {
  const engine = WorkflowEngine.getInstance();

  // Standard booking workflow
  const standardBookingWorkflow: WorkflowDefinition = {
    id: 'standard_booking',
    name: 'Standard Booking Process',
    description: 'Standard customer booking workflow with payment',
    version: '1.0.0',
    initialStep: 'validate_request',
    steps: new Map([
      ['validate_request', {
        id: 'validate_request',
        name: 'Validate Booking Request',
        description: 'Validate booking data and check availability',
        type: 'action',
        config: { actionType: 'validate_booking' },
        retryable: false,
        onSuccess: 'create_booking',
        onFailure: 'notify_validation_failure',
      }],
      ['create_booking', {
        id: 'create_booking',
        name: 'Create Booking Record',
        description: 'Create booking in database',
        type: 'action',
        config: { actionType: 'create_booking' },
        retryable: true,
        onSuccess: 'process_payment',
        onFailure: 'notify_creation_failure',
      }],
      ['process_payment', {
        id: 'process_payment',
        name: 'Process Payment',
        description: 'Process customer payment',
        type: 'action',
        config: { actionType: 'process_payment' },
        retryable: true,
        timeout: 30000,
        onSuccess: 'send_confirmation',
        onFailure: 'handle_payment_failure',
        onTimeout: 'handle_payment_timeout',
      }],
      ['send_confirmation', {
        id: 'send_confirmation',
        name: 'Send Confirmation',
        description: 'Send booking confirmation to customer',
        type: 'notification',
        config: { notificationType: 'booking_confirmation' },
        retryable: true,
        onSuccess: 'complete',
      }],
    ]),
    globalTimeout: 300000, // 5 minutes
    maxRetries: 3,
    metadata: {
      category: 'booking',
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['booking', 'payment', 'standard'],
    },
  };

  engine.registerWorkflow(standardBookingWorkflow);

  // Admin booking workflow (without payment)
  const adminBookingWorkflow: WorkflowDefinition = {
    id: 'admin_booking',
    name: 'Admin Booking Process',
    description: 'Administrative booking workflow without payment',
    version: '1.0.0',
    initialStep: 'validate_admin_request',
    steps: new Map([
      ['validate_admin_request', {
        id: 'validate_admin_request',
        name: 'Validate Admin Request',
        description: 'Validate admin booking request',
        type: 'action',
        config: { actionType: 'validate_admin_booking' },
        retryable: false,
        onSuccess: 'create_admin_booking',
      }],
      ['create_admin_booking', {
        id: 'create_admin_booking',
        name: 'Create Admin Booking',
        description: 'Create booking with admin privileges',
        type: 'action',
        config: { actionType: 'create_admin_booking' },
        retryable: true,
        onSuccess: 'assign_resources',
      }],
      ['assign_resources', {
        id: 'assign_resources',
        name: 'Assign Resources',
        description: 'Assign staff and wash bay',
        type: 'action',
        config: { actionType: 'assign_resources' },
        retryable: true,
        onSuccess: 'send_admin_confirmation',
      }],
    ]),
    metadata: {
      category: 'admin',
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['booking', 'admin', 'no-payment'],
    },
  };

  engine.registerWorkflow(adminBookingWorkflow);
}

// Export singleton instance
export const workflowEngine = WorkflowEngine.getInstance();