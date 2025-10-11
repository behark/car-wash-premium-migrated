/**
 * Business Rules Engine
 * Configurable business logic engine with rule evaluation and management
 */

import { logger } from '../logger';
import { BusinessError } from '../errors';

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata: {
    version: string;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
  };
}

export interface RuleCondition {
  type: 'field_value' | 'field_comparison' | 'date_range' | 'time_range' | 'custom_function';
  field?: string;
  operator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'between';
  value?: any;
  values?: any[];
  customFunction?: string;
  negated?: boolean;
}

export interface RuleAction {
  type: 'block' | 'warn' | 'modify_value' | 'add_surcharge' | 'require_approval' | 'custom_function';
  message?: string;
  value?: any;
  customFunction?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RuleEvaluationContext {
  data: any;
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  request?: {
    ip: string;
    userAgent: string;
    correlationId: string;
  };
  metadata: Record<string, any>;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  actions: RuleAction[];
  message?: string;
  executionTime: number;
  error?: string;
}

export interface RuleSetEvaluationResult {
  allRulesPassed: boolean;
  blockingFailures: RuleEvaluationResult[];
  warnings: RuleEvaluationResult[];
  modifications: Array<{
    field: string;
    originalValue: any;
    newValue: any;
    ruleId: string;
  }>;
  totalExecutionTime: number;
  rulesEvaluated: number;
}

/**
 * Configurable business rules engine
 */
export class BusinessRulesEngine {
  private static instance: BusinessRulesEngine;
  private rules = new Map<string, BusinessRule>();
  private customFunctions = new Map<string, Function>();
  private evaluationHistory: Array<{
    ruleId: string;
    context: any;
    result: RuleEvaluationResult;
    timestamp: Date;
  }> = [];

  static getInstance(): BusinessRulesEngine {
    if (!BusinessRulesEngine.instance) {
      BusinessRulesEngine.instance = new BusinessRulesEngine();
    }
    return BusinessRulesEngine.instance;
  }

  constructor() {
    this.initializeDefaultRules();
    this.initializeCustomFunctions();
  }

  /**
   * Add or update a business rule
   */
  addRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);

    logger.audit('business_rule_added', 'rule', undefined, {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      enabled: rule.enabled,
    });
  }

  /**
   * Remove a business rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);

    if (removed) {
      logger.audit('business_rule_removed', 'rule', undefined, { ruleId });
    }

    return removed;
  }

  /**
   * Enable or disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    rule.metadata.updatedAt = new Date();

    logger.audit('business_rule_toggled', 'rule', undefined, {
      ruleId,
      enabled,
    });

    return true;
  }

  /**
   * Evaluate all applicable rules against provided data
   */
  async evaluateRules(
    category: string,
    context: RuleEvaluationContext
  ): Promise<RuleSetEvaluationResult> {
    const startTime = Date.now();
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled && rule.category === category)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    const results: RuleEvaluationResult[] = [];
    const blockingFailures: RuleEvaluationResult[] = [];
    const warnings: RuleEvaluationResult[] = [];
    const modifications: Array<{
      field: string;
      originalValue: any;
      newValue: any;
      ruleId: string;
    }> = [];

    for (const rule of applicableRules) {
      try {
        const result = await this.evaluateRule(rule, context);
        results.push(result);

        // Record evaluation history
        this.evaluationHistory.push({
          ruleId: rule.id,
          context: this.sanitizeContextForHistory(context),
          result,
          timestamp: new Date(),
        });

        // Process rule results
        if (!result.passed) {
          const hasBlockingActions = result.actions.some(
            action => action.type === 'block' || action.priority === 'critical'
          );

          if (hasBlockingActions) {
            blockingFailures.push(result);
          } else {
            warnings.push(result);
          }
        }

        // Process modification actions
        for (const action of result.actions) {
          if (action.type === 'modify_value' && action.value !== undefined) {
            const field = rule.conditions[0]?.field;
            if (field) {
              modifications.push({
                field,
                originalValue: this.getFieldValue(context.data, field),
                newValue: action.value,
                ruleId: rule.id,
              });

              // Apply modification to context for subsequent rules
              this.setFieldValue(context.data, field, action.value);
            }
          }
        }
      } catch (error) {
        logger.error('Rule evaluation error', error, {
          ruleId: rule.id,
          ruleName: rule.name,
          context: this.sanitizeContextForHistory(context),
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          passed: false,
          actions: [{ type: 'block', message: 'Rule evaluation failed', priority: 'high' }],
          executionTime: 0,
          error: (error as Error).message,
        });
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      allRulesPassed: blockingFailures.length === 0,
      blockingFailures,
      warnings,
      modifications,
      totalExecutionTime,
      rulesEvaluated: results.length,
    };
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    rule: BusinessRule,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      // Evaluate all conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(condition => this.evaluateCondition(condition, context))
      );

      // All conditions must pass (AND logic)
      const allConditionsPassed = conditionResults.every(result => result);
      const executionTime = Date.now() - startTime;

      if (allConditionsPassed) {
        // Rule conditions passed - return actions
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          passed: false, // Actions indicate rule was triggered
          actions: rule.actions,
          message: `Rule triggered: ${rule.name}`,
          executionTime,
        };
      } else {
        // Rule conditions not met - rule passes
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          passed: true,
          actions: [],
          executionTime,
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: false,
        actions: [{ type: 'block', message: 'Rule evaluation failed', priority: 'high' }],
        executionTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    let result = false;

    switch (condition.type) {
      case 'field_value':
        result = this.evaluateFieldValue(condition, context);
        break;

      case 'field_comparison':
        result = this.evaluateFieldComparison(condition, context);
        break;

      case 'date_range':
        result = this.evaluateDateRange(condition, context);
        break;

      case 'time_range':
        result = this.evaluateTimeRange(condition, context);
        break;

      case 'custom_function':
        result = await this.evaluateCustomFunction(condition, context);
        break;

      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }

    // Apply negation if specified
    return condition.negated ? !result : result;
  }

  private evaluateFieldValue(condition: RuleCondition, context: RuleEvaluationContext): boolean {
    if (!condition.field || !condition.operator) return false;

    const fieldValue = this.getFieldValue(context.data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        return typeof fieldValue === 'string' &&
               typeof condition.value === 'string' &&
               fieldValue.includes(condition.value);

      case 'in':
        return Array.isArray(condition.values) &&
               condition.values.includes(fieldValue);

      default:
        return false;
    }
  }

  private evaluateFieldComparison(condition: RuleCondition, context: RuleEvaluationContext): boolean {
    if (!condition.field || !condition.operator) return false;

    const fieldValue = this.getFieldValue(context.data, condition.field);

    switch (condition.operator) {
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);

      case 'less_than':
        return Number(fieldValue) < Number(condition.value);

      case 'between':
        if (!Array.isArray(condition.values) || condition.values.length !== 2) return false;
        const numValue = Number(fieldValue);
        return numValue >= condition.values[0] && numValue <= condition.values[1];

      default:
        return false;
    }
  }

  private evaluateDateRange(condition: RuleCondition, context: RuleEvaluationContext): boolean {
    if (!condition.field || !condition.values) return false;

    const fieldValue = this.getFieldValue(context.data, condition.field);
    if (!fieldValue) return false;

    const date = new Date(fieldValue);
    const [startDate, endDate] = condition.values.map((d: any) => new Date(d));

    return date >= startDate && date <= endDate;
  }

  private evaluateTimeRange(condition: RuleCondition, context: RuleEvaluationContext): boolean {
    if (!condition.field || !condition.values) return false;

    const fieldValue = this.getFieldValue(context.data, condition.field);
    if (!fieldValue) return false;

    const time = typeof fieldValue === 'string' ? fieldValue :
                 fieldValue instanceof Date ? fieldValue.toTimeString().substring(0, 5) : '';

    const [startTime, endTime] = condition.values;
    return time >= startTime && time <= endTime;
  }

  private async evaluateCustomFunction(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    if (!condition.customFunction) return false;

    const customFn = this.customFunctions.get(condition.customFunction);
    if (!customFn) {
      throw new Error(`Custom function not found: ${condition.customFunction}`);
    }

    try {
      const result = await customFn(context.data, context);
      return Boolean(result);
    } catch (error) {
      logger.error('Custom function evaluation error', error, {
        functionName: condition.customFunction,
        context: this.sanitizeContextForHistory(context),
      });
      return false;
    }
  }

  /**
   * Add custom function for rule evaluation
   */
  addCustomFunction(name: string, fn: Function): void {
    this.customFunctions.set(name, fn);

    logger.audit('custom_function_added', 'business_rules_engine', undefined, {
      functionName: name,
    });
  }

  /**
   * Remove custom function
   */
  removeCustomFunction(name: string): boolean {
    return this.customFunctions.delete(name);
  }

  /**
   * Get all rules in a category
   */
  getRulesByCategory(category: string): BusinessRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  /**
   * Get rule evaluation history
   */
  getEvaluationHistory(limit = 100): Array<{
    ruleId: string;
    context: any;
    result: RuleEvaluationResult;
    timestamp: Date;
  }> {
    return this.evaluationHistory.slice(-limit);
  }

  /**
   * Get rule performance metrics
   */
  getRuleMetrics(): Array<{
    ruleId: string;
    ruleName: string;
    evaluationCount: number;
    averageExecutionTime: number;
    successRate: number;
    lastEvaluated?: Date;
  }> {
    const metrics = new Map<string, {
      count: number;
      totalTime: number;
      successCount: number;
      lastEvaluated: Date;
    }>();

    for (const history of this.evaluationHistory) {
      const existing = metrics.get(history.ruleId) || {
        count: 0,
        totalTime: 0,
        successCount: 0,
        lastEvaluated: history.timestamp,
      };

      existing.count++;
      existing.totalTime += history.result.executionTime;
      if (history.result.passed) {
        existing.successCount++;
      }
      if (history.timestamp > existing.lastEvaluated) {
        existing.lastEvaluated = history.timestamp;
      }

      metrics.set(history.ruleId, existing);
    }

    return Array.from(metrics.entries()).map(([ruleId, data]) => {
      const rule = this.rules.get(ruleId);
      return {
        ruleId,
        ruleName: rule?.name || 'Unknown',
        evaluationCount: data.count,
        averageExecutionTime: data.totalTime / data.count,
        successRate: data.successCount / data.count,
        lastEvaluated: data.lastEvaluated,
      };
    });
  }

  // Private helper methods

  private getFieldValue(data: any, fieldPath: string): any {
    const path = fieldPath.split('.');
    let current = data;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  private setFieldValue(data: any, fieldPath: string, value: any): void {
    const path = fieldPath.split('.');
    let current = data;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (current[segment] === undefined) {
        current[segment] = {};
      }
      current = current[segment];
    }

    current[path[path.length - 1]] = value;
  }

  private sanitizeContextForHistory(context: RuleEvaluationContext): any {
    return {
      dataKeys: Object.keys(context.data || {}),
      userId: context.user?.id,
      userRole: context.user?.role,
      requestIp: context.request?.ip,
      correlationId: context.request?.correlationId,
    };
  }

  private initializeDefaultRules(): void {
    // Booking advance time rule
    this.addRule({
      id: 'booking_advance_time',
      name: 'Minimum Advance Booking Time',
      description: 'Ensure bookings are made with sufficient advance notice',
      category: 'booking_validation',
      enabled: true,
      priority: 100,
      conditions: [
        {
          type: 'custom_function',
          customFunction: 'validateAdvanceTime',
        },
      ],
      actions: [
        {
          type: 'block',
          message: 'Booking must be made at least 2 hours in advance',
          priority: 'high',
        },
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['booking', 'validation', 'advance-time'],
      },
    });

    // Business hours rule
    this.addRule({
      id: 'business_hours_validation',
      name: 'Business Hours Validation',
      description: 'Ensure bookings are within business operating hours',
      category: 'booking_validation',
      enabled: true,
      priority: 90,
      conditions: [
        {
          type: 'custom_function',
          customFunction: 'validateBusinessHours',
        },
      ],
      actions: [
        {
          type: 'block',
          message: 'Booking time is outside business hours',
          priority: 'medium',
        },
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['booking', 'validation', 'business-hours'],
      },
    });

    // Weekend premium pricing rule
    this.addRule({
      id: 'weekend_premium',
      name: 'Weekend Premium Pricing',
      description: 'Apply premium pricing for weekend bookings',
      category: 'pricing',
      enabled: true,
      priority: 50,
      conditions: [
        {
          type: 'custom_function',
          customFunction: 'isWeekend',
        },
      ],
      actions: [
        {
          type: 'add_surcharge',
          value: 0.1, // 10% surcharge
          message: 'Weekend premium applied',
          priority: 'low',
        },
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['pricing', 'weekend', 'surcharge'],
      },
    });

    // Customer booking limit rule
    this.addRule({
      id: 'customer_daily_limit',
      name: 'Customer Daily Booking Limit',
      description: 'Limit number of bookings per customer per day',
      category: 'booking_validation',
      enabled: true,
      priority: 80,
      conditions: [
        {
          type: 'custom_function',
          customFunction: 'checkCustomerDailyLimit',
        },
      ],
      actions: [
        {
          type: 'require_approval',
          message: 'Customer has reached daily booking limit - requires approval',
          priority: 'medium',
        },
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['booking', 'validation', 'customer-limits'],
      },
    });
  }

  private initializeCustomFunctions(): void {
    // Advance time validation
    this.addCustomFunction('validateAdvanceTime', (data: any) => {
      if (!data.scheduledDateTime) return true;

      const scheduledTime = new Date(data.scheduledDateTime);
      const now = new Date();
      const hoursInAdvance = differenceInHours(scheduledTime, now);

      return hoursInAdvance >= 2; // Minimum 2 hours advance
    });

    // Business hours validation
    this.addCustomFunction('validateBusinessHours', (data: any) => {
      if (!data.scheduledDateTime) return true;

      const scheduledTime = new Date(data.scheduledDateTime);
      const hour = scheduledTime.getHours();
      const dayOfWeek = scheduledTime.getDay();

      // Basic business hours: 8:00-18:00, Monday-Saturday
      if (dayOfWeek === 0) return false; // Sunday closed
      return hour >= 8 && hour < 18;
    });

    // Weekend detection
    this.addCustomFunction('isWeekend', (data: any) => {
      if (!data.scheduledDateTime) return false;

      const scheduledTime = new Date(data.scheduledDateTime);
      const dayOfWeek = scheduledTime.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    });

    // Customer daily limit check
    this.addCustomFunction('checkCustomerDailyLimit', async (data: any, context: RuleEvaluationContext) => {
      if (!data.customerEmail || !data.scheduledDateTime) return true;

      // This would check against existing bookings in the database
      // For now, return a simple check
      const dailyBookings = context.metadata?.customerDailyBookings || 0;
      return dailyBookings < 3; // Max 3 bookings per day
    });

    // Vehicle type validation
    this.addCustomFunction('validateVehicleType', (data: any) => {
      const allowedTypes = ['sedan', 'suv', 'van', 'truck', 'motorcycle'];
      return allowedTypes.includes(data.vehicleType);
    });

    // Service availability validation
    this.addCustomFunction('validateServiceAvailability', async (data: any, context: RuleEvaluationContext) => {
      if (!data.serviceId) return false;

      // Check if service is active and available
      const serviceInfo = context.metadata?.serviceInfo;
      return serviceInfo?.isActive === true;
    });
  }

  /**
   * Create booking validation rules
   */
  createBookingValidationRules(): BusinessRule[] {
    return [
      this.rules.get('booking_advance_time'),
      this.rules.get('business_hours_validation'),
      this.rules.get('customer_daily_limit'),
    ].filter(Boolean) as BusinessRule[];
  }

  /**
   * Create pricing rules
   */
  createPricingRules(): BusinessRule[] {
    return [
      this.rules.get('weekend_premium'),
    ].filter(Boolean) as BusinessRule[];
  }

  /**
   * Export rules configuration
   */
  exportRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Import rules configuration
   */
  importRules(rules: BusinessRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }

    logger.info('Business rules imported', {
      importedCount: rules.length,
      totalRules: this.rules.size,
    });
  }
}

// Export singleton instance
export const businessRulesEngine = BusinessRulesEngine.getInstance();