#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Ensures all required environment variables are set for production
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Required environment variables with validation rules
const requiredVars = {
  // Database
  DATABASE_URL: {
    pattern: /^postgresql:\/\/.+/,
    description: 'PostgreSQL connection string',
    sensitive: true,
  },

  // Authentication
  NEXTAUTH_URL: {
    pattern: /^https?:\/\/.+/,
    description: 'NextAuth URL',
  },
  NEXTAUTH_SECRET: {
    minLength: 32,
    description: 'NextAuth secret key',
    sensitive: true,
  },

  // Email
  SENDGRID_API_KEY: {
    pattern: /^SG\..+/,
    description: 'SendGrid API key',
    sensitive: true,
  },
  SENDER_EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    description: 'Sender email address',
  },

  // Payment
  STRIPE_SECRET_KEY: {
    pattern: /^sk_(test|live)_.+/,
    description: 'Stripe secret key',
    sensitive: true,
  },
  STRIPE_PUBLISHABLE_KEY: {
    pattern: /^pk_(test|live)_.+/,
    description: 'Stripe publishable key',
  },
  STRIPE_WEBHOOK_SECRET: {
    pattern: /^whsec_.+/,
    description: 'Stripe webhook secret',
    sensitive: true,
  },

  // SMS (Optional but recommended)
  TWILIO_ACCOUNT_SID: {
    pattern: /^AC.+/,
    description: 'Twilio Account SID',
    optional: true,
    sensitive: true,
  },
  TWILIO_AUTH_TOKEN: {
    minLength: 32,
    description: 'Twilio Auth Token',
    optional: true,
    sensitive: true,
  },

  // Monitoring
  SENTRY_DSN: {
    pattern: /^https:\/\/.+@.+\.ingest\.sentry\.io\/.+/,
    description: 'Sentry DSN',
    optional: true,
  },

  // Security
  RECAPTCHA_SITE_KEY: {
    minLength: 20,
    description: 'reCAPTCHA site key',
  },
  RECAPTCHA_SECRET_KEY: {
    minLength: 20,
    description: 'reCAPTCHA secret key',
    sensitive: true,
  },
};

// Optional but recommended variables
const optionalVars = {
  BACKUP_ENCRYPTION_KEY: {
    minLength: 32,
    description: 'Backup encryption key',
    sensitive: true,
  },
  JWT_SECRET: {
    minLength: 32,
    description: 'JWT secret key',
    sensitive: true,
  },
  MONITORING_WEBHOOK_URL: {
    pattern: /^https?:\/\/.+/,
    description: 'Monitoring webhook URL',
  },
  RATE_LIMIT_MAX_REQUESTS: {
    pattern: /^\d+$/,
    description: 'Rate limit maximum requests',
  },
  LOG_LEVEL: {
    pattern: /^(error|warn|info|debug)$/,
    description: 'Logging level',
  },
};

// Security checks
const securityChecks = {
  checkWeakSecrets: (value, name) => {
    const weakPatterns = [
      /password/i,
      /12345/,
      /admin/i,
      /test/i,
      /demo/i,
      /example/i,
      /changeme/i,
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(value)) {
        return `Weak or default value detected`;
      }
    }

    // Check entropy for secrets
    if (name.includes('SECRET') || name.includes('KEY')) {
      const entropy = calculateEntropy(value);
      if (entropy < 40) {
        return `Low entropy (${entropy.toFixed(1)} bits). Use a stronger secret`;
      }
    }

    return null;
  },

  checkProductionValues: (value, name) => {
    // Check for development/test values in production
    if (process.env.NODE_ENV === 'production') {
      if (value.includes('localhost') || value.includes('127.0.0.1')) {
        return 'Contains localhost reference in production';
      }
      if (value.includes('test') && !name.includes('STRIPE')) {
        return 'Contains test value in production';
      }
    }
    return null;
  },

  checkUrlFormat: (value, name) => {
    if (name.includes('URL') && !name.includes('DATABASE')) {
      try {
        const url = new URL(value);
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          return 'Should use HTTPS in production';
        }
      } catch (e) {
        return 'Invalid URL format';
      }
    }
    return null;
  },
};

// Calculate entropy of a string
function calculateEntropy(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / str.length;
    entropy -= p * Math.log2(p);
  }

  return entropy * str.length;
}

// Validate a single environment variable
function validateVar(name, config, value) {
  const errors = [];

  // Check if required and missing
  if (!value) {
    if (!config.optional) {
      errors.push('Required but not set');
    }
    return errors;
  }

  // Pattern validation
  if (config.pattern && !config.pattern.test(value)) {
    errors.push(`Does not match required pattern: ${config.pattern}`);
  }

  // Length validation
  if (config.minLength && value.length < config.minLength) {
    errors.push(`Too short (minimum ${config.minLength} characters)`);
  }

  if (config.maxLength && value.length > config.maxLength) {
    errors.push(`Too long (maximum ${config.maxLength} characters)`);
  }

  // Security checks
  const securityIssue = securityChecks.checkWeakSecrets(value, name);
  if (securityIssue) {
    errors.push(securityIssue);
  }

  const productionIssue = securityChecks.checkProductionValues(value, name);
  if (productionIssue) {
    errors.push(productionIssue);
  }

  const urlIssue = securityChecks.checkUrlFormat(value, name);
  if (urlIssue) {
    errors.push(urlIssue);
  }

  return errors;
}

// Main validation function
function validateEnvironment() {
  console.log(`${colors.cyan}🔍 Validating Environment Variables${colors.reset}\n`);

  let hasErrors = false;
  let warningCount = 0;
  const results = {
    valid: [],
    invalid: [],
    missing: [],
    warnings: [],
  };

  // Check required variables
  console.log(`${colors.blue}Required Variables:${colors.reset}`);
  for (const [name, config] of Object.entries(requiredVars)) {
    const value = process.env[name];
    const errors = validateVar(name, config, value);

    if (!value && !config.optional) {
      console.log(`  ${colors.red}✗${colors.reset} ${name}: Missing`);
      results.missing.push(name);
      hasErrors = true;
    } else if (errors.length > 0) {
      console.log(`  ${colors.red}✗${colors.reset} ${name}: ${errors.join(', ')}`);
      results.invalid.push({ name, errors });
      hasErrors = true;
    } else {
      const displayValue = config.sensitive ? '***' : value.substring(0, 20) + '...';
      console.log(`  ${colors.green}✓${colors.reset} ${name}: ${displayValue}`);
      results.valid.push(name);
    }
  }

  // Check optional variables
  console.log(`\n${colors.blue}Optional Variables:${colors.reset}`);
  for (const [name, config] of Object.entries(optionalVars)) {
    const value = process.env[name];

    if (!value) {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${name}: Not set (optional)`);
      results.warnings.push(`${name} is not set`);
      warningCount++;
    } else {
      const errors = validateVar(name, config, value);
      if (errors.length > 0) {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${name}: ${errors.join(', ')}`);
        results.warnings.push(`${name}: ${errors.join(', ')}`);
        warningCount++;
      } else {
        const displayValue = config.sensitive ? '***' : value.substring(0, 20) + '...';
        console.log(`  ${colors.green}✓${colors.reset} ${name}: ${displayValue}`);
        results.valid.push(name);
      }
    }
  }

  // Additional checks
  console.log(`\n${colors.blue}Security Checks:${colors.reset}`);

  // Check NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  ${colors.yellow}⚠${colors.reset} NODE_ENV is not set to 'production'`);
    warningCount++;
  } else {
    console.log(`  ${colors.green}✓${colors.reset} NODE_ENV is set to production`);
  }

  // Check for .env file in production
  if (process.env.NODE_ENV === 'production' && fs.existsSync('.env')) {
    console.log(`  ${colors.red}✗${colors.reset} .env file exists in production (security risk)`);
    hasErrors = true;
  }

  // Summary
  console.log(`\n${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Valid: ${colors.green}${results.valid.length}${colors.reset}`);
  console.log(`  Invalid: ${colors.red}${results.invalid.length}${colors.reset}`);
  console.log(`  Missing: ${colors.red}${results.missing.length}${colors.reset}`);
  console.log(`  Warnings: ${colors.yellow}${warningCount}${colors.reset}`);

  if (hasErrors) {
    console.log(`\n${colors.red}❌ Environment validation failed!${colors.reset}`);
    console.log('Please fix the errors above before deploying to production.\n');

    // Generate report file
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      results,
      hasErrors,
      warningCount,
    };

    fs.writeFileSync(
      'env-validation-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('Detailed report saved to env-validation-report.json\n');

    process.exit(1);
  } else if (warningCount > 0) {
    console.log(`\n${colors.yellow}⚠ Environment validation passed with warnings${colors.reset}`);
    console.log('Consider addressing the warnings for better security.\n');
  } else {
    console.log(`\n${colors.green}✅ Environment validation passed!${colors.reset}`);
    console.log('All required environment variables are properly configured.\n');
  }

  return !hasErrors;
}

// Generate example .env file
function generateExample() {
  console.log(`${colors.cyan}Generating .env.example file...${colors.reset}`);

  let content = '# Generated Environment Variables Example\n';
  content += '# Copy this file to .env.local or .env.production and fill in your values\n\n';

  for (const [name, config] of Object.entries({ ...requiredVars, ...optionalVars })) {
    content += `# ${config.description}`;
    if (config.optional) content += ' (Optional)';
    content += '\n';

    if (config.pattern) {
      content += `# Pattern: ${config.pattern}\n`;
    }
    if (config.minLength) {
      content += `# Min length: ${config.minLength}\n`;
    }

    content += `${name}=\n\n`;
  }

  fs.writeFileSync('.env.example.generated', content);
  console.log(`${colors.green}✓${colors.reset} Generated .env.example.generated\n`);
}

// Run validation
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--generate')) {
    generateExample();
  } else {
    // Load environment variables from file if specified
    if (args.includes('--file')) {
      const fileIndex = args.indexOf('--file');
      const envFile = args[fileIndex + 1];

      if (fs.existsSync(envFile)) {
        require('dotenv').config({ path: envFile });
        console.log(`Loaded environment from: ${envFile}\n`);
      } else {
        console.error(`${colors.red}Error: File not found: ${envFile}${colors.reset}`);
        process.exit(1);
      }
    }

    validateEnvironment();
  }
}

module.exports = { validateEnvironment, validateVar };