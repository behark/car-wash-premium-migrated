/**
 * Environment Variable Validation System
 * Ensures all required environment variables are set and valid
 */

import { z } from 'zod';

// Define environment variable schemas
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Authentication (NextAuth)
  NEXTAUTH_URL: z.string().url().min(1, 'NEXTAUTH_URL is required'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_').optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'STRIPE_PUBLISHABLE_KEY must start with pk_'),

  // SendGrid
  SENDGRID_API_KEY: z.string().startsWith('SG.', 'SENDGRID_API_KEY must start with SG.'),
  SENDER_EMAIL: z.string().email('SENDER_EMAIL must be a valid email'),

  // Application URLs
  NEXT_PUBLIC_SITE_URL: z.string().url().min(1, 'NEXT_PUBLIC_SITE_URL is required'),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database Pool Settings (optional)
  DB_MAX_CONNECTIONS: z.string().transform(Number).pipe(z.number().positive()).optional(),
  DB_POOL_TIMEOUT: z.string().transform(Number).pipe(z.number().positive()).optional(),
  DB_CONNECT_TIMEOUT: z.string().transform(Number).pipe(z.number().positive()).optional(),

  // Monitoring Settings (optional)
  ENABLE_DB_MONITORING: z.string().transform(v => v === 'true').optional(),
  SLOW_QUERY_THRESHOLD: z.string().transform(Number).pipe(z.number().positive()).optional(),
  MAX_QUERY_HISTORY: z.string().transform(Number).pipe(z.number().positive()).optional(),

  // Optional services
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().optional(),

  // Build-time settings
  NEXT_TELEMETRY_DISABLED: z.string().optional(),
  ANALYZE: z.string().optional(),
});

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>;

// Partial schema for development (some vars can be missing)
const devEnvSchema = envSchema.partial({
  STRIPE_WEBHOOK_SECRET: true,
  SENDGRID_API_KEY: true,
  SENDER_EMAIL: true,
  SENTRY_DSN: true,
  POSTHOG_API_KEY: true,
  POSTHOG_HOST: true,
});

/**
 * Validates environment variables
 * @param throwOnError - If true, throws an error if validation fails
 * @returns Validation result with parsed environment variables
 */
export function validateEnv(throwOnError = true) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const schema = isDevelopment ? devEnvSchema : envSchema;

  try {
    const parsed = schema.parse(process.env);
    return {
      success: true,
      data: parsed as Env,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      if (throwOnError) {
        console.error('❌ Environment validation failed:');
        errors.forEach((err: any) => {
          console.error(`  - ${err.path}: ${err.message}`);
        });
        throw new Error('Environment validation failed. Please check your environment variables.');
      }

      return {
        success: false,
        data: null,
        errors,
      };
    }

    throw error;
  }
}

/**
 * Gets validated environment variables (singleton)
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    const result = validateEnv(true);
    if (!result.success || !result.data) {
      throw new Error('Failed to validate environment variables');
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}

/**
 * Checks if all required production environment variables are set
 */
export function checkProductionEnv(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'SENDGRID_API_KEY',
    'SENDER_EMAIL',
    'NEXT_PUBLIC_SITE_URL',
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required production environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    return false;
  }

  return true;
}

/**
 * Logs environment configuration (redacted)
 */
export function logEnvConfig() {
  const env = process.env;
  const config = {
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL ? '✅ Set (redacted)' : '❌ Not set',
    NEXTAUTH_URL: env.NEXTAUTH_URL || '❌ Not set',
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ? '✅ Set (redacted)' : '❌ Not set',
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY ? '✅ Set (redacted)' : '❌ Not set',
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET ? '✅ Set (redacted)' : '❌ Not set',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Not set',
    SENDGRID_API_KEY: env.SENDGRID_API_KEY ? '✅ Set (redacted)' : '❌ Not set',
    SENDER_EMAIL: env.SENDER_EMAIL || '❌ Not set',
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL || '❌ Not set',
    SENTRY_DSN: env.SENTRY_DSN ? '✅ Set (redacted)' : '⚠️ Not set (optional)',
    POSTHOG_API_KEY: env.POSTHOG_API_KEY ? '✅ Set (redacted)' : '⚠️ Not set (optional)',
  };

  console.log('🔧 Environment Configuration:');
  Object.entries(config).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
}