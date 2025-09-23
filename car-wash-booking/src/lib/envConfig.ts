import { logger } from './logger';

interface EnvConfig {
  database: {
    url: string;
    isConfigured: boolean;
  };
  auth: {
    url: string;
    secret: string;
    isConfigured: boolean;
  };
  admin: {
    email: string;
    password: string;
    isConfigured: boolean;
  };
  email: {
    apiKey: string;
    senderEmail: string;
    isConfigured: boolean;
  };
  sms: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    isConfigured: boolean;
  };
  app: {
    nodeEnv: string;
    siteUrl: string;
    netlifyContext: string;
  };
}

export function getEnvironmentConfig(): EnvConfig {
  // Auto-detect Netlify context and build appropriate URLs
  const netlifyContext = process.env.CONTEXT || 'production';
  const deployUrl = process.env.DEPLOY_URL || process.env.URL || 'http://localhost:3000';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || deployUrl;

  // Generate NextAuth URL based on deployment context
  const authUrl = netlifyContext === 'deploy-preview'
    ? deployUrl
    : process.env.NEXTAUTH_URL || siteUrl;

  return {
    database: {
      url: process.env.DATABASE_URL || '',
      isConfigured: !!(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql'))
    },
    auth: {
      url: authUrl,
      secret: process.env.NEXTAUTH_SECRET || '',
      isConfigured: !!(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32)
    },
    admin: {
      email: process.env.ADMIN_EMAIL || '',
      password: process.env.ADMIN_PASSWORD || '',
      isConfigured: !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    },
    email: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      senderEmail: process.env.SENDER_EMAIL || '',
      isConfigured: !!(process.env.SENDGRID_API_KEY?.startsWith('SG.') && process.env.SENDER_EMAIL)
    },
    sms: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM || '',
      isConfigured: !!(
        process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM
      )
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      siteUrl,
      netlifyContext
    }
  };
}

export function validateEnvironment(): { isValid: boolean; missing: string[]; warnings: string[] } {
  const config = getEnvironmentConfig();
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required for basic functionality
  if (!config.database.isConfigured) {
    missing.push('DATABASE_URL (PostgreSQL connection string)');
  }

  if (!config.auth.isConfigured) {
    missing.push('NEXTAUTH_SECRET (64+ character random string)');
  }

  if (!config.admin.isConfigured) {
    missing.push('ADMIN_EMAIL and ADMIN_PASSWORD');
  }

  // Optional but recommended for production
  if (!config.email.isConfigured && config.app.nodeEnv === 'production') {
    warnings.push('Email notifications not configured (SENDGRID_API_KEY, SENDER_EMAIL)');
  }

  if (!config.sms.isConfigured && config.app.nodeEnv === 'production') {
    warnings.push('SMS notifications not configured (TWILIO credentials)');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  };
}

export function logEnvironmentStatus(): void {
  const config = getEnvironmentConfig();
  const validation = validateEnvironment();

  logger.info('Environment configuration status', {
    context: config.app.netlifyContext,
    siteUrl: config.app.siteUrl,
    database: config.database.isConfigured,
    auth: config.auth.isConfigured,
    admin: config.admin.isConfigured,
    email: config.email.isConfigured,
    sms: config.sms.isConfigured,
    isValid: validation.isValid,
    missing: validation.missing,
    warnings: validation.warnings
  });
}