/**
 * Comprehensive API Validation Schemas
 * Enterprise-grade Zod schemas with custom validators and error handling
 */

import { z } from 'zod';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { parseISO, isValid as isValidDate, isFuture } from 'date-fns';

/**
 * Custom Zod validators
 */

// Finnish phone number validator
const finnishPhoneRegex = /^(\+358|0)[1-9][0-9]{6,8}$/;
export const phoneValidator = z.string().regex(
  finnishPhoneRegex,
  'Invalid Finnish phone number format. Use +358XXXXXXXX or 0XXXXXXXX'
);

// License plate validator (Finnish format)
const licensePlateRegex = /^[A-Z]{1,3}-[0-9]{1,3}$/;
export const licensePlateValidator = z.string().regex(
  licensePlateRegex,
  'Invalid license plate format. Use ABC-123 format'
);

// Business hours time validator (HH:MM format)
export const timeValidator = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Invalid time format. Use HH:MM format'
);

// Date string validator (YYYY-MM-DD)
export const dateStringValidator = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Invalid date format. Use YYYY-MM-DD format'
).refine((date) => {
  const parsed = parseISO(date);
  return isValidDate(parsed);
}, 'Invalid date value');

// Future date validator
export const futureDateValidator = dateStringValidator.refine((date) => {
  const parsed = parseISO(date);
  return isFuture(parsed);
}, 'Date must be in the future');

// Past or present date validator
export const pastOrPresentDateValidator = dateStringValidator.refine((date) => {
  const parsed = parseISO(date);
  return !isFuture(parsed);
}, 'Date cannot be in the future');

// Email with custom domain validation
export const emailValidator = z.string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .refine((email) => {
    // Additional validation for suspicious patterns
    const suspiciousPatterns = [
      /test@test\./,
      /example@example\./,
      /admin@admin\./,
      /noreply@noreply\./
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(email));
  }, 'Invalid email address');

// Password validator with strength requirements
export const passwordValidator = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine((password) => {
    // At least one uppercase letter
    return /[A-Z]/.test(password);
  }, 'Password must contain at least one uppercase letter')
  .refine((password) => {
    // At least one lowercase letter
    return /[a-z]/.test(password);
  }, 'Password must contain at least one lowercase letter')
  .refine((password) => {
    // At least one number
    return /[0-9]/.test(password);
  }, 'Password must contain at least one number')
  .refine((password) => {
    // At least one special character
    return /[^A-Za-z0-9]/.test(password);
  }, 'Password must contain at least one special character');

// Currency amount validator (in cents)
export const currencyValidator = z.number()
  .int('Amount must be a whole number')
  .min(0, 'Amount cannot be negative')
  .max(1000000, 'Amount too large'); // Max €10,000

// Positive integer validator
export const positiveIntValidator = z.number()
  .int('Must be an integer')
  .positive('Must be a positive number');

// Non-negative integer validator
export const nonNegativeIntValidator = z.number()
  .int('Must be an integer')
  .min(0, 'Cannot be negative');

/**
 * Base schemas
 */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const sortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const timestampSchema = z.object({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Service schemas
 */

export const serviceCreateSchema = z.object({
  titleFi: z.string()
    .min(1, 'Finnish title is required')
    .max(100, 'Finnish title must not exceed 100 characters')
    .trim(),
  titleEn: z.string()
    .min(1, 'English title is required')
    .max(100, 'English title must not exceed 100 characters')
    .trim(),
  descriptionFi: z.string()
    .min(10, 'Finnish description must be at least 10 characters')
    .max(1000, 'Finnish description must not exceed 1000 characters')
    .trim(),
  descriptionEn: z.string()
    .min(10, 'English description must be at least 10 characters')
    .max(1000, 'English description must not exceed 1000 characters')
    .trim(),
  priceCents: currencyValidator,
  durationMinutes: z.number()
    .int('Duration must be a whole number')
    .min(15, 'Duration must be at least 15 minutes')
    .max(480, 'Duration must not exceed 8 hours'),
  capacity: positiveIntValidator.max(10, 'Capacity cannot exceed 10'),
  image: z.string().url('Invalid image URL').optional(),
  isActive: z.boolean().default(true),
});

export const serviceUpdateSchema = serviceCreateSchema.partial().extend({
  id: positiveIntValidator,
});

export const serviceQuerySchema = z.object({
  includeInactive: z.boolean().default(false),
  category: z.string().optional(),
  minPrice: currencyValidator.optional(),
  maxPrice: currencyValidator.optional(),
  minDuration: nonNegativeIntValidator.optional(),
  maxDuration: nonNegativeIntValidator.optional(),
}).merge(paginationSchema).merge(sortingSchema);

/**
 * Booking schemas
 */

export const bookingCreateSchema = z.object({
  serviceId: positiveIntValidator,
  vehicleType: z.enum(['sedan', 'suv', 'van', 'truck', 'motorcycle'], {
    errorMap: () => ({ message: 'Invalid vehicle type' })
  }),
  date: futureDateValidator,
  startTime: timeValidator,
  customerName: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name must not exceed 100 characters')
    .trim()
    .refine((name) => {
      // Basic name validation - only letters, spaces, hyphens, apostrophes
      return /^[a-zA-ZäöåÄÖÅ\s\-']+$/.test(name);
    }, 'Customer name contains invalid characters'),
  customerEmail: emailValidator,
  customerPhone: phoneValidator,
  licensePlate: licensePlateValidator.optional(),
  notes: z.string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional()
    .transform(val => val?.trim()),
}).refine((data) => {
  // Validate time slot is reasonable (not too early/late)
  const [hours] = data.startTime.split(':').map(Number);
  return hours >= 6 && hours <= 22;
}, {
  message: 'Booking time must be between 06:00 and 22:00',
  path: ['startTime']
});

export const bookingUpdateSchema = z.object({
  id: positiveIntValidator,
  status: z.nativeEnum(BookingStatus).optional(),
  adminNotes: z.string().max(1000, 'Admin notes must not exceed 1000 characters').optional(),
  assignedStaffId: positiveIntValidator.optional(),
  assignedBayId: positiveIntValidator.optional(),
});

export const bookingQuerySchema = z.object({
  customerId: z.string().optional(),
  customerEmail: emailValidator.optional(),
  serviceId: positiveIntValidator.optional(),
  status: z.array(z.nativeEnum(BookingStatus)).optional(),
  paymentStatus: z.array(z.nativeEnum(PaymentStatus)).optional(),
  dateFrom: dateStringValidator.optional(),
  dateTo: dateStringValidator.optional(),
  assignedStaffId: positiveIntValidator.optional(),
  assignedBayId: positiveIntValidator.optional(),
}).merge(paginationSchema).merge(sortingSchema);

export const bookingCancellationSchema = z.object({
  id: positiveIntValidator,
  reason: z.string()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(500, 'Cancellation reason must not exceed 500 characters')
    .optional(),
  refundAmount: currencyValidator.optional(),
});

export const availabilityQuerySchema = z.object({
  serviceId: positiveIntValidator,
  date: futureDateValidator,
  includeCapacity: z.boolean().default(false),
  timeZone: z.string().default('Europe/Helsinki'),
});

/**
 * User and authentication schemas
 */

export const userCreateSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: emailValidator,
  password: passwordValidator,
  role: z.enum(['user', 'admin', 'staff']).default('user'),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  id: positiveIntValidator,
});

export const loginSchema = z.object({
  email: emailValidator,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const resetPasswordSchema = z.object({
  email: emailValidator,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordValidator,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Password confirmation does not match',
  path: ['confirmPassword']
});

/**
 * Payment schemas
 */

export const paymentIntentSchema = z.object({
  amount: currencyValidator,
  currency: z.enum(['eur']).default('eur'),
  bookingId: positiveIntValidator,
  customerEmail: emailValidator,
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  savePaymentMethod: z.boolean().default(false),
});

export const webhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  type: z.string(),
  created: z.number(),
  data: z.object({
    object: z.any(),
  }),
});

/**
 * Settings and configuration schemas
 */

export const businessHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeValidator,
  endTime: timeValidator,
  isOpen: z.boolean(),
  breakStart: timeValidator.optional(),
  breakEnd: timeValidator.optional(),
}).refine((data) => {
  if (data.isOpen) {
    // Validate that end time is after start time
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine((data) => {
  if (data.breakStart && data.breakEnd) {
    // Validate break times are within business hours
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const [breakStartHour, breakStartMin] = data.breakStart.split(':').map(Number);
    const [breakEndHour, breakEndMin] = data.breakEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const breakStartMinutes = breakStartHour * 60 + breakStartMin;
    const breakEndMinutes = breakEndHour * 60 + breakEndMin;

    return breakStartMinutes >= startMinutes &&
           breakEndMinutes <= endMinutes &&
           breakEndMinutes > breakStartMinutes;
  }
  return true;
}, {
  message: 'Break times must be within business hours and break end must be after break start',
  path: ['breakEnd']
});

export const holidaySchema = z.object({
  date: dateStringValidator,
  name: z.string()
    .min(1, 'Holiday name is required')
    .max(100, 'Holiday name must not exceed 100 characters')
    .trim(),
  description: z.string()
    .max(500, 'Holiday description must not exceed 500 characters')
    .optional()
    .transform(val => val?.trim()),
});

/**
 * Notification schemas
 */

export const notificationPreferenceSchema = z.object({
  customerEmail: emailValidator,
  bookingReminders: z.boolean().default(true),
  paymentConfirmations: z.boolean().default(true),
  promotionalOffers: z.boolean().default(false),
  statusUpdates: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
  smsNotifications: z.boolean().default(false),
  pushNotifications: z.boolean().default(true),
  reminderHoursBefore: z.number().int().min(1).max(168).default(24), // 1 hour to 1 week
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required'),
  }),
  customerEmail: emailValidator.optional(),
});

/**
 * File upload schemas
 */

export const fileUploadSchema = z.object({
  file: z.any().refine((file) => {
    return file && file.size > 0;
  }, 'File is required'),
  purpose: z.enum(['service_image', 'profile_avatar', 'booking_photo']),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB default
});

/**
 * API Response schemas
 */

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  timestamp: z.string().datetime(),
  correlationId: z.string().optional(),
});

/**
 * Health check schema
 */

export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.record(z.object({
    status: z.enum(['up', 'down', 'degraded']),
    responseTime: z.number().optional(),
    details: z.any().optional(),
  })),
});

/**
 * Search and filter schemas
 */

export const searchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(100, 'Search query must not exceed 100 characters')
    .trim(),
  filters: z.record(z.any()).optional(),
}).merge(paginationSchema);

/**
 * Validation helpers
 */

export function validateAndTransform<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = validateAndTransform(schema, data);

    if (!result.success) {
      const { ValidationError } = require('../errors');
      const errors = result.errors.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: undefined, // ZodIssue doesn't have input property
      }));

      throw new ValidationError('Validation failed', errors);
    }

    return result.data;
  };
}

/**
 * Type exports for TypeScript inference
 */

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
export type ServiceQueryInput = z.infer<typeof serviceQuerySchema>;

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;
export type BookingCancellationInput = z.infer<typeof bookingCancellationSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>;
export type WebhookInput = z.infer<typeof webhookSchema>;

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
export type HolidayInput = z.infer<typeof holidaySchema>;

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export type PaginationInput = z.infer<typeof paginationSchema>;
export type SortingInput = z.infer<typeof sortingSchema>;
export type SearchInput = z.infer<typeof searchSchema>;