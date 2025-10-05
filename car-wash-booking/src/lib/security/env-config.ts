import { z } from 'zod';

/**
 * Secure environment variable configuration with validation
 */

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Admin credentials
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),

  // Email configuration
  SENDGRID_API_KEY: z.string().startsWith('SG.'),
  SENDER_EMAIL: z.string().email(),

  // SMS configuration
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  // Payment (Stripe)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // Redis (for rate limiting and caching)
  REDIS_URL: z.string().url().optional(),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Maps (optional)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Security
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION: z.coerce.number().int().positive().default(900000), // 15 minutes in ms
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(86400), // 24 hours in seconds

  // Feature flags
  MAINTENANCE_MODE: z.enum(['true', 'false']).optional(),
  ENABLE_REGISTRATION: z.enum(['true', 'false']).optional(),
  ENABLE_PAYMENTS: z.enum(['true', 'false']).optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: EnvConfig | null = null;
  private errors: string[] = [];

  private constructor() {}

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Initialize and validate environment configuration
   */
  initialize(): void {
    try {
      // Parse and validate environment variables
      this.config = envSchema.parse(process.env);

      // Additional security checks
      this.performSecurityChecks();

      console.log('✅ Environment configuration validated successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.errors = error.issues.map(e => `${e.path.join('.')}: ${e.message}`);

        // In production, fail fast for critical configuration errors
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Critical environment configuration errors:');
          this.errors.forEach(err => console.error(`  - ${err}`));
          process.exit(1);
        } else {
          // In development, log warnings but continue
          console.warn('⚠️ Environment configuration warnings:');
          this.errors.forEach(err => console.warn(`  - ${err}`));
        }
      } else {
        console.error('❌ Unexpected error validating environment:', error);
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        }
      }
    }
  }

  /**
   * Perform additional security checks on configuration
   */
  private performSecurityChecks(): void {
    if (!this.config) return;

    const warnings: string[] = [];

    // Check for weak secrets
    if (this.config.NEXTAUTH_SECRET.length < 64) {
      warnings.push('NEXTAUTH_SECRET should be at least 64 characters for production');
    }

    // Check for insecure protocols in production
    if (this.config.NODE_ENV === 'production') {
      if (!this.config.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
        warnings.push('NEXT_PUBLIC_SITE_URL should use HTTPS in production');
      }

      if (!this.config.NEXTAUTH_URL.startsWith('https://')) {
        warnings.push('NEXTAUTH_URL should use HTTPS in production');
      }

      // Check for test keys in production
      if (this.config.STRIPE_SECRET_KEY?.includes('test')) {
        warnings.push('⚠️ Using Stripe test keys in production environment');
      }
    }

    // Check for default/weak admin password
    const weakPasswords = ['password', 'admin123', '12345678', 'password123'];
    if (weakPasswords.includes(this.config.ADMIN_PASSWORD.toLowerCase())) {
      warnings.push('⚠️ ADMIN_PASSWORD appears to be weak. Use a strong password!');
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn('⚠️ Security configuration warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }

  /**
   * Get a specific environment variable with type safety
   */
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    if (!this.config) {
      throw new Error('Environment configuration not initialized');
    }
    return this.config[key];
  }

  /**
   * Get all configuration (for debugging purposes only)
   */
  getAll(): EnvConfig | null {
    return this.config;
  }

  /**
   * Get sanitized configuration (safe to expose to client)
   */
  getPublicConfig() {
    if (!this.config) {
      throw new Error('Environment configuration not initialized');
    }

    return {
      siteUrl: this.config.NEXT_PUBLIC_SITE_URL,
      googleMapsApiKey: this.config.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      stripePublishableKey: this.config.STRIPE_PUBLISHABLE_KEY,
      maintenanceMode: this.config.MAINTENANCE_MODE === 'true',
      enableRegistration: this.config.ENABLE_REGISTRATION === 'true',
      enablePayments: this.config.ENABLE_PAYMENTS === 'true',
    };
  }

  /**
   * Check if a feature flag is enabled
   */
  isFeatureEnabled(feature: 'registration' | 'payments' | 'maintenance'): boolean {
    if (!this.config) return false;

    switch (feature) {
      case 'registration':
        return this.config.ENABLE_REGISTRATION === 'true';
      case 'payments':
        return this.config.ENABLE_PAYMENTS === 'true';
      case 'maintenance':
        return this.config.MAINTENANCE_MODE === 'true';
      default:
        return false;
    }
  }

  /**
   * Get allowed origins for CORS
   */
  getAllowedOrigins(): string[] {
    if (!this.config) return [];

    const origins = this.config.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

    // Always include the site URL
    if (!origins.includes(this.config.NEXT_PUBLIC_SITE_URL)) {
      origins.push(this.config.NEXT_PUBLIC_SITE_URL);
    }

    return origins;
  }

  /**
   * Validate if the configuration is valid
   */
  isValid(): boolean {
    return this.config !== null && this.errors.length === 0;
  }

  /**
   * Get configuration errors
   */
  getErrors(): string[] {
    return this.errors;
  }
}

// Export singleton instance
export const envConfig = EnvironmentConfig.getInstance();

// Initialize on module load
if (typeof window === 'undefined') {
  // Only initialize on server side
  envConfig.initialize();
}

/**
 * Type-safe environment variable getter
 */
export function getEnv<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  return envConfig.get(key);
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return envConfig.get('NODE_ENV') === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return envConfig.get('NODE_ENV') === 'development';
}

/**
 * Get secure cookie options based on environment
 */
export function getSecureCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict' as const,
    path: '/',
    maxAge: envConfig.get('SESSION_MAX_AGE'),
  };
}