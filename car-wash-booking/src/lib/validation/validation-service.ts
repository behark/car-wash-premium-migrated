/**
 * Validation Service
 * Enterprise validation patterns with error integration and advanced features
 */

import { z } from 'zod';
import { ValidationError, BusinessError } from '../errors';
import { logger } from '../logger';

export interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  allowUnknown?: boolean;
  context?: Record<string, any>;
  customValidators?: Map<string, (value: any, context?: any) => boolean | string>;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
    code?: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface BatchValidationResult<T> {
  success: boolean;
  results: Array<ValidationResult<T>>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    errors: number;
    warnings: number;
  };
}

export interface ValidationRule {
  field: string;
  validator: (value: any, data: any, context?: any) => boolean | string;
  message?: string;
  optional?: boolean;
  dependsOn?: string[];
}

export interface ConditionalValidation {
  condition: (data: any, context?: any) => boolean;
  schema: z.ZodSchema<any>;
  message?: string;
}

/**
 * Advanced validation service with enterprise features
 */
export class ValidationService {
  private static instance: ValidationService;
  private customValidators = new Map<string, (value: any, context?: any) => boolean | string>();
  private validationCache = new Map<string, ValidationResult<any>>();
  private validationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    cacheHits: 0,
    averageValidationTime: 0,
  };

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  constructor() {
    this.initializeCustomValidators();
  }

  /**
   * Validate data against a Zod schema with enhanced error handling
   */
  async validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    const startTime = Date.now();
    this.validationMetrics.totalValidations++;

    try {
      // Check cache if enabled
      const cacheKey = this.generateCacheKey(schema, data, options);
      if (options.context?.useCache && this.validationCache.has(cacheKey)) {
        this.validationMetrics.cacheHits++;
        return this.validationCache.get(cacheKey)!;
      }

      // Perform validation
      const result = await this.performValidation(schema, data, options);

      // Update metrics
      const validationTime = Date.now() - startTime;
      this.updateMetrics(result.success, validationTime);

      // Cache result if enabled
      if (options.context?.useCache && result.success) {
        this.validationCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.error('Validation service error', {
        error: error instanceof Error ? error.message : error,
        schema: schema._def,
        data: typeof data === 'object' ? Object.keys(data || {}) : typeof data,
      });

      return {
        success: false,
        errors: [{
          field: 'validation',
          message: 'Validation service error occurred',
          code: 'VALIDATION_SERVICE_ERROR',
        }],
      };
    }
  }

  /**
   * Validate data with conditional schemas
   */
  async validateConditional<T>(
    conditionalValidations: ConditionalValidation[],
    data: unknown,
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];
    const warnings: Array<{ field: string; message: string; value?: any }> = [];

    for (const conditional of conditionalValidations) {
      try {
        if (conditional.condition(data, options.context)) {
          const result = await this.validate(conditional.schema, data, options);

          if (!result.success && result.errors) {
            errors.push(...result.errors);
          }

          if (result.warnings) {
            warnings.push(...result.warnings);
          }
        }
      } catch (error) {
        errors.push({
          field: 'conditional',
          message: conditional.message || 'Conditional validation failed',
          code: 'CONDITIONAL_VALIDATION_ERROR',
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    return { success: true, data: data as T, warnings };
  }

  /**
   * Validate multiple items in batch
   */
  async validateBatch<T>(
    schema: z.ZodSchema<T>,
    items: unknown[],
    options: ValidationOptions = {}
  ): Promise<BatchValidationResult<T>> {
    const results: Array<ValidationResult<T>> = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const result = await this.validate(schema, item, {
          ...options,
          context: { ...options.context, batchIndex: i },
        });

        results.push(result);

        if (result.errors) {
          totalErrors += result.errors.length;
        }
        if (result.warnings) {
          totalWarnings += result.warnings.length;
        }
      } catch (error) {
        results.push({
          success: false,
          errors: [{
            field: `item[${i}]`,
            message: 'Batch validation error',
            code: 'BATCH_VALIDATION_ERROR',
          }],
        });
        totalErrors++;
      }
    }

    const validCount = results.filter(r => r.success).length;

    return {
      success: validCount === items.length,
      results,
      summary: {
        total: items.length,
        valid: validCount,
        invalid: items.length - validCount,
        errors: totalErrors,
        warnings: totalWarnings,
      },
    };
  }

  /**
   * Validate with custom business rules
   */
  async validateWithRules<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    rules: ValidationRule[],
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    // First, validate with schema
    const schemaResult = await this.validate(schema, data, options);

    if (!schemaResult.success) {
      return schemaResult;
    }

    // Then, apply custom rules
    const ruleErrors: Array<{ field: string; message: string; code?: string }> = [];

    for (const rule of rules) {
      try {
        const value = this.getFieldValue(schemaResult.data, rule.field);

        // Check dependencies
        if (rule.dependsOn) {
          const dependenciesMet = rule.dependsOn.every(dep =>
            this.getFieldValue(schemaResult.data, dep) !== undefined
          );

          if (!dependenciesMet) {
            continue; // Skip rule if dependencies not met
          }
        }

        // Skip if field is optional and not provided
        if (rule.optional && (value === undefined || value === null)) {
          continue;
        }

        const validationResult = rule.validator(value, schemaResult.data, options.context);

        if (validationResult !== true) {
          ruleErrors.push({
            field: rule.field,
            message: typeof validationResult === 'string' ? validationResult : (rule.message || 'Validation failed'),
            code: 'BUSINESS_RULE_VIOLATION',
          });
        }
      } catch (error) {
        ruleErrors.push({
          field: rule.field,
          message: 'Rule validation error',
          code: 'RULE_VALIDATION_ERROR',
        });
      }
    }

    if (ruleErrors.length > 0) {
      return {
        success: false,
        errors: [...(schemaResult.errors || []), ...ruleErrors],
        warnings: schemaResult.warnings,
      };
    }

    return schemaResult;
  }

  /**
   * Create validation middleware for API routes
   */
  createValidationMiddleware<T>(
    schema: z.ZodSchema<T>,
    options: ValidationOptions = {}
  ) {
    return async (data: unknown): Promise<T> => {
      const result = await this.validate(schema, data, options);

      if (!result.success) {
        const validationError = new ValidationError(
          'Request validation failed',
          result.errors || [],
          { validationOptions: options }
        );

        throw validationError;
      }

      return result.data!;
    };
  }

  /**
   * Sanitize and validate data
   */
  async sanitizeAndValidate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    sanitizers: Map<string, (value: any) => any> = new Map(),
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    try {
      // Apply sanitizers
      const sanitizedData = this.applySanitizers(data, sanitizers);

      // Validate sanitized data
      return await this.validate(schema, sanitizedData, options);
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'sanitization',
          message: 'Data sanitization failed',
          code: 'SANITIZATION_ERROR',
        }],
      };
    }
  }

  /**
   * Validate file uploads
   */
  async validateFileUpload(
    file: any,
    constraints: {
      maxSize?: number;
      allowedTypes?: string[];
      allowedExtensions?: string[];
      minDimensions?: { width: number; height: number };
      maxDimensions?: { width: number; height: number };
    } = {}
  ): Promise<ValidationResult<any>> {
    const errors: Array<{ field: string; message: string; code?: string }> = [];

    try {
      // Size validation
      if (constraints.maxSize && file.size > constraints.maxSize) {
        errors.push({
          field: 'file',
          message: `File size exceeds maximum allowed size of ${constraints.maxSize} bytes`,
          code: 'FILE_TOO_LARGE',
        });
      }

      // Type validation
      if (constraints.allowedTypes && !constraints.allowedTypes.includes(file.type)) {
        errors.push({
          field: 'file',
          message: `File type ${file.type} is not allowed`,
          code: 'INVALID_FILE_TYPE',
        });
      }

      // Extension validation
      if (constraints.allowedExtensions) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !constraints.allowedExtensions.includes(extension)) {
          errors.push({
            field: 'file',
            message: `File extension .${extension} is not allowed`,
            code: 'INVALID_FILE_EXTENSION',
          });
        }
      }

      // Image dimension validation (if applicable)
      if (file.type.startsWith('image/') && (constraints.minDimensions || constraints.maxDimensions)) {
        // This would require image processing library in real implementation
        // For now, we'll skip dimension validation
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: file };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'file',
          message: 'File validation error',
          code: 'FILE_VALIDATION_ERROR',
        }],
      };
    }
  }

  /**
   * Add custom validator
   */
  addCustomValidator(
    name: string,
    validator: (value: any, context?: any) => boolean | string
  ): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Remove custom validator
   */
  removeCustomValidator(name: string): void {
    this.customValidators.delete(name);
  }

  /**
   * Get validation metrics
   */
  getMetrics() {
    return { ...this.validationMetrics };
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Create validation error
   */
  createValidationError(
    errors: Array<{ field: string; message: string; value?: any }>,
    message = 'Validation failed'
  ): ValidationError {
    return new ValidationError(message, errors);
  }

  // Private helper methods

  private async performValidation<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    options: ValidationOptions
  ): Promise<ValidationResult<T>> {
    try {
      const parseOptions: any = {};

      if (options.abortEarly === false) {
        parseOptions.abortEarly = false;
      }

      const result = schema.safeParse(data);

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.') || 'root',
          message: err.message,
          value: err.input,
          code: err.code,
        }));

        return {
          success: false,
          errors,
        };
      }
    } catch (error) {
      throw error;
    }
  }

  private applySanitizers(
    data: unknown,
    sanitizers: Map<string, (value: any) => any>
  ): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data } as any;

    for (const [field, sanitizer] of sanitizers) {
      if (field in sanitized) {
        try {
          sanitized[field] = sanitizer(sanitized[field]);
        } catch (error) {
          // Log sanitizer error but don't fail validation
          logger.warn('Sanitizer error', { field, error });
        }
      }
    }

    return sanitized;
  }

  private getFieldValue(data: any, fieldPath: string): any {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

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

  private generateCacheKey(
    schema: z.ZodSchema<any>,
    data: unknown,
    options: ValidationOptions
  ): string {
    try {
      const schemaHash = JSON.stringify(schema._def).slice(0, 100);
      const dataHash = JSON.stringify(data).slice(0, 100);
      const optionsHash = JSON.stringify(options).slice(0, 50);

      return `${schemaHash}_${dataHash}_${optionsHash}`;
    } catch (error) {
      return Math.random().toString(36);
    }
  }

  private updateMetrics(success: boolean, validationTime: number): void {
    if (success) {
      this.validationMetrics.successfulValidations++;
    } else {
      this.validationMetrics.failedValidations++;
    }

    // Update average validation time
    const totalValidations = this.validationMetrics.totalValidations;
    this.validationMetrics.averageValidationTime =
      (this.validationMetrics.averageValidationTime * (totalValidations - 1) + validationTime) /
      totalValidations;
  }

  private initializeCustomValidators(): void {
    // Finnish business ID validator
    this.addCustomValidator('finnishBusinessId', (value: string) => {
      if (!value || typeof value !== 'string') return false;

      const businessIdRegex = /^\d{7}-\d$/;
      if (!businessIdRegex.test(value)) {
        return 'Invalid Finnish business ID format';
      }

      // Validate checksum
      const digits = value.replace('-', '');
      const checksum = parseInt(digits[7]);
      const multipliers = [7, 9, 10, 5, 8, 4, 2];

      let sum = 0;
      for (let i = 0; i < 7; i++) {
        sum += parseInt(digits[i]) * multipliers[i];
      }

      const calculatedChecksum = sum % 11;
      const expectedChecksum = calculatedChecksum === 0 ? 0 : 11 - calculatedChecksum;

      return checksum === expectedChecksum || 'Invalid Finnish business ID checksum';
    });

    // Finnish personal ID validator
    this.addCustomValidator('finnishPersonalId', (value: string) => {
      if (!value || typeof value !== 'string') return false;

      const personalIdRegex = /^\d{6}[+-A]\d{3}[0-9A-Z]$/;
      if (!personalIdRegex.test(value)) {
        return 'Invalid Finnish personal ID format';
      }

      // Additional validation logic would go here
      return true;
    });

    // Strong password validator
    this.addCustomValidator('strongPassword', (value: string) => {
      if (!value || typeof value !== 'string') return false;

      const checks = [
        { test: value.length >= 12, message: 'Password must be at least 12 characters' },
        { test: /[a-z]/.test(value), message: 'Password must contain lowercase letters' },
        { test: /[A-Z]/.test(value), message: 'Password must contain uppercase letters' },
        { test: /[0-9]/.test(value), message: 'Password must contain numbers' },
        { test: /[^A-Za-z0-9]/.test(value), message: 'Password must contain special characters' },
        { test: !/(.)\1{2,}/.test(value), message: 'Password cannot contain repeated characters' },
      ];

      for (const check of checks) {
        if (!check.test) {
          return check.message;
        }
      }

      return true;
    });

    // IBAN validator
    this.addCustomValidator('iban', (value: string) => {
      if (!value || typeof value !== 'string') return false;

      // Remove spaces and convert to uppercase
      const iban = value.replace(/\s/g, '').toUpperCase();

      // Basic format check
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
        return 'Invalid IBAN format';
      }

      // MOD-97 checksum validation would go here
      return true;
    });
  }
}

// Export singleton instance
export const validationService = ValidationService.getInstance();