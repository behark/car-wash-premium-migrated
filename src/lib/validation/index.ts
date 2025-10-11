/**
 * Validation Module Exports
 * Centralized access to all validation functionality
 */

// Export all schemas
export * from './schemas';

// Export validation service
export {
  ValidationService,
  validationService,
  type ValidationOptions,
  type ValidationResult,
  type BatchValidationResult,
  type ValidationRule,
  type ConditionalValidation,
} from './validation-service';

// Re-export commonly used validators from schemas
export {
  phoneValidator,
  licensePlateValidator,
  timeValidator,
  dateStringValidator,
  futureDateValidator,
  pastOrPresentDateValidator,
  emailValidator,
  passwordValidator,
  currencyValidator,
  positiveIntValidator,
  nonNegativeIntValidator,
} from './schemas';

// Re-export validation helpers
export {
  validateAndTransform,
  createValidationMiddleware,
} from './schemas';

/**
 * Validation utilities
 */

import { z } from 'zod';
import { validationService } from './validation-service';
import { ValidationError } from '../errors';

/**
 * Quick validation function for single schema
 */
export async function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  throwOnError = true
): Promise<T> {
  const result = await validationService.validate(schema, data);

  if (!result.success) {
    if (throwOnError) {
      throw new ValidationError(
        'Validation failed',
        result.errors || []
      );
    }
    throw new Error('Validation failed');
  }

  return result.data!;
}

/**
 * Validation decorator for class methods
 */
export function ValidateInput<T>(schema: z.ZodSchema<T>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate the first argument (assumed to be input data)
      if (args.length > 0) {
        args[0] = await validate(schema, args[0]);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Validation middleware for Express-like frameworks
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return async (req: any, res: any, next: any) => {
    try {
      const data = req[source];
      const validatedData = await validate(schema, data);
      req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validatedData;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.getUserMessage(),
            details: error.context.validationErrors,
          },
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Create a validated API handler
 */
export function createValidatedHandler<TInput, TOutput>(
  inputSchema: z.ZodSchema<TInput>,
  handler: (input: TInput, context?: any) => Promise<TOutput> | TOutput,
  options: {
    outputSchema?: z.ZodSchema<TOutput>;
    validateOutput?: boolean;
  } = {}
) {
  return async (input: unknown, context?: any): Promise<TOutput> => {
    // Validate input
    const validatedInput = await validate(inputSchema, input);

    // Execute handler
    const result = await handler(validatedInput, context);

    // Optionally validate output
    if (options.validateOutput && options.outputSchema) {
      return await validate(options.outputSchema, result);
    }

    return result;
  };
}

/**
 * Batch validation utility
 */
export async function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[],
  options: {
    failFast?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<{ valid: T[]; invalid: Array<{ item: unknown; errors: any[] }> }> {
  const { failFast = false, maxConcurrency = 10 } = options;

  const valid: T[] = [];
  const invalid: Array<{ item: unknown; errors: any[] }> = [];

  if (maxConcurrency === 1) {
    // Sequential processing
    for (const item of items) {
      try {
        const result = await validationService.validate(schema, item);
        if (result.success) {
          valid.push(result.data!);
        } else {
          invalid.push({ item, errors: result.errors || [] });
          if (failFast) break;
        }
      } catch (error) {
        invalid.push({ item, errors: [{ field: 'unknown', message: 'Validation error' }] });
        if (failFast) break;
      }
    }
  } else {
    // Concurrent processing with limit
    const chunks = [];
    for (let i = 0; i < items.length; i += maxConcurrency) {
      chunks.push(items.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (item) => {
        try {
          const result = await validationService.validate(schema, item);
          return { success: result.success, data: result.data, errors: result.errors, item };
        } catch (error) {
          return { success: false, errors: [{ field: 'unknown', message: 'Validation error' }], item };
        }
      });

      const results = await Promise.all(promises);

      for (const result of results) {
        if (result.success) {
          valid.push(result.data!);
        } else {
          invalid.push({ item: result.item, errors: result.errors || [] });
          if (failFast) break;
        }
      }

      if (failFast && invalid.length > 0) break;
    }
  }

  return { valid, invalid };
}

/**
 * Type-safe validation with inference
 */
export function createTypedValidator<T>(schema: z.ZodSchema<T>) {
  return {
    async validate(data: unknown): Promise<T> {
      return validate(schema, data);
    },

    validateSync(data: unknown): T {
      const result = schema.safeParse(data);
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.input,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      return result.data;
    },

    isValid(data: unknown): data is T {
      return schema.safeParse(data).success;
    },

    getErrors(data: unknown): Array<{ field: string; message: string }> | null {
      const result = schema.safeParse(data);
      if (result.success) return null;

      return result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
    },
  };
}

/**
 * Schema composition utilities
 */
export const SchemaUtils = {
  /**
   * Make all fields optional
   */
  makeOptional<T>(schema: z.ZodSchema<T>): z.ZodSchema<Partial<T>> {
    return schema.partial();
  },

  /**
   * Pick specific fields from schema
   */
  pick<T, K extends keyof T>(
    schema: z.ZodObject<any>,
    keys: K[]
  ): z.ZodObject<Pick<z.infer<typeof schema>, K>> {
    return schema.pick(keys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as any));
  },

  /**
   * Omit specific fields from schema
   */
  omit<T, K extends keyof T>(
    schema: z.ZodObject<any>,
    keys: K[]
  ): z.ZodObject<Omit<z.infer<typeof schema>, K>> {
    return schema.omit(keys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as any));
  },

  /**
   * Extend schema with additional fields
   */
  extend<T, U>(
    schema: z.ZodObject<any>,
    extension: z.ZodObject<any>
  ): z.ZodObject<z.infer<typeof schema> & z.infer<typeof extension>> {
    return schema.extend(extension.shape);
  },

  /**
   * Create union of schemas
   */
  union<T extends readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
    schemas: T
  ): z.ZodUnion<T> {
    return z.union(schemas);
  },

  /**
   * Create discriminated union
   */
  discriminatedUnion<T extends string, U extends Record<string, z.ZodTypeAny>>(
    discriminator: T,
    options: U
  ): any {
    return z.discriminatedUnion(discriminator, Object.values(options) as any);
  },
};

/**
 * Performance monitoring for validation
 */
export const ValidationMetrics = {
  getMetrics() {
    return validationService.getMetrics();
  },

  clearCache() {
    validationService.clearCache();
  },

  addCustomValidator(name: string, validator: (value: any, context?: any) => boolean | string) {
    validationService.addCustomValidator(name, validator);
  },

  removeCustomValidator(name: string) {
    validationService.removeCustomValidator(name);
  },
};