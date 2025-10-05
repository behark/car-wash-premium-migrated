/**
 * Validation Schemas and Utilities
 * Provides reusable validation schemas using Zod
 */

import { z } from 'zod';

/**
 * Common field validators
 */
export const CommonValidators = {
  // Email validation
  email: z.string().email('Invalid email address'),

  // Phone number validation (Finnish format)
  phone: z.string()
    .min(8, 'Phone number must be at least 8 characters')
    .regex(
      /^(\+358|0)[1-9]\d{6,11}$/,
      'Invalid Finnish phone number format'
    ),

  // Date validation (YYYY-MM-DD format)
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform(str => new Date(str))
    .refine(date => !isNaN(date.getTime()), 'Invalid date')
    .refine(date => date >= new Date(new Date().setHours(0, 0, 0, 0)), 'Date must be today or in the future'),

  // Time validation (HH:MM format)
  time: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),

  // License plate validation (Finnish format)
  licensePlate: z.string()
    .regex(
      /^[A-Z]{1,3}-\d{1,3}$|^[A-Z]{2,3}\d{1,3}$|^CD-\d{1,5}$/,
      'Invalid Finnish license plate format'
    )
    .optional(),

  // Positive integer
  positiveInt: z.number().int().positive(),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Confirmation code
  confirmationCode: z.string()
    .length(8, 'Confirmation code must be 8 characters')
    .regex(/^[A-Z0-9]{8}$/, 'Invalid confirmation code format'),

  // Safe string (no HTML/script tags)
  safeString: z.string()
    .transform(str => str.trim())
    .refine(
      str => !/<script|<iframe|javascript:|on\w+=/i.test(str),
      'Invalid characters detected'
    ),

  // Optional notes field
  notes: z.string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .transform(str => str?.trim()),
};

/**
 * Booking creation schema
 */
export const BookingCreateSchema = z.object({
  serviceId: CommonValidators.positiveInt,
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  date: CommonValidators.date,
  startTime: CommonValidators.time,
  customerName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .transform(str => str.trim())
    .refine(
      str => !/<script|<iframe|javascript:|on\w+=/i.test(str),
      'Invalid characters detected'
    ),
  customerEmail: CommonValidators.email,
  customerPhone: CommonValidators.phone,
  licensePlate: CommonValidators.licensePlate,
  notes: CommonValidators.notes,
});

/**
 * Booking query schema
 */
export const BookingQuerySchema = z.object({
  id: z.union([
    CommonValidators.positiveInt,
    CommonValidators.confirmationCode,
  ]).optional(),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .optional(),
  customerEmail: CommonValidators.email.optional(),
});

/**
 * Service query schema
 */
export const ServiceQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  vehicleType: z.string().optional(),
});

/**
 * Availability check schema
 */
export const AvailabilityQuerySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  serviceId: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0, 'Invalid service ID'),
});

/**
 * Payment session schema
 */
export const PaymentSessionSchema = z.object({
  bookingId: CommonValidators.positiveInt,
  successUrl: z.string().url('Success URL must be a valid URL'),
  cancelUrl: z.string().url('Cancel URL must be a valid URL'),
});

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, 'Page must be positive'),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

/**
 * Validates request body against a schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and transformed data
 * @throws ZodError if validation fails
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}

/**
 * Validates query parameters against a schema
 * @param schema - Zod schema to validate against
 * @param params - Query parameters to validate
 * @returns Validated and transformed parameters
 * @throws ZodError if validation fails
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  params: unknown
): T {
  return schema.parse(params);
}

/**
 * Safe validation that returns result object instead of throwing
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Success or error result
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Type exports for use in endpoints
 */
export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;
export type BookingQueryInput = z.infer<typeof BookingQuerySchema>;
export type ServiceQueryInput = z.infer<typeof ServiceQuerySchema>;
export type AvailabilityQueryInput = z.infer<typeof AvailabilityQuerySchema>;
export type PaymentSessionInput = z.infer<typeof PaymentSessionSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;