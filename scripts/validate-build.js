#!/usr/bin/env node

/**
 * Pre-build Validation Script
 * Ensures the environment is ready for production build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log(`═══════════════════════════════════════`, colors.cyan);
  log(`  ${title}`, colors.cyan);
  log(`═══════════════════════════════════════`, colors.cyan);
}

function runCommand(command, throwOnError = false) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, output };
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: error.message };
  }
}

class BuildValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // Check Node.js version
  validateNodeVersion() {
    logSection('Node.js Version Check');
    const nodeVersion = process.version;
    const requiredMajorVersion = 18;
    const currentMajorVersion = parseInt(nodeVersion.split('.')[0].replace('v', ''));

    if (currentMajorVersion < requiredMajorVersion) {
      this.errors.push(`Node.js version ${requiredMajorVersion} or higher is required. Current: ${nodeVersion}`);
      log(`❌ Node.js version check failed`, colors.red);
    } else {
      log(`✅ Node.js version: ${nodeVersion}`, colors.green);
    }
  }

  // Check required environment variables
  validateEnvironment() {
    logSection('Environment Variables');

    const requiredVars = {
      DATABASE_URL: 'Database connection string',
      NEXTAUTH_URL: 'NextAuth URL for authentication',
      NEXTAUTH_SECRET: 'NextAuth secret for JWT',
    };

    const productionVars = {
      STRIPE_SECRET_KEY: 'Stripe API key',
      STRIPE_WEBHOOK_SECRET: 'Stripe webhook secret',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'Stripe public key',
      SENDGRID_API_KEY: 'SendGrid API key',
      SENDER_EMAIL: 'Email sender address',
      NEXT_PUBLIC_SITE_URL: 'Public site URL',
    };

    // Check required vars
    Object.entries(requiredVars).forEach(([key, description]) => {
      if (!process.env[key]) {
        const message = `Missing required: ${key} - ${description}`;
        if (this.isProduction) {
          this.errors.push(message);
          log(`❌ ${message}`, colors.red);
        } else {
          this.warnings.push(message);
          log(`⚠️  ${message}`, colors.yellow);
        }
      } else {
        log(`✅ ${key} is set`, colors.green);
      }
    });

    // Check production vars (only error in production)
    if (this.isProduction) {
      Object.entries(productionVars).forEach(([key, description]) => {
        if (!process.env[key]) {
          const message = `Missing production var: ${key} - ${description}`;
          this.errors.push(message);
          log(`❌ ${message}`, colors.red);
        } else {
          log(`✅ ${key} is set`, colors.green);
        }
      });
    }

    // Check optional monitoring vars
    const optionalVars = ['SENTRY_DSN', 'POSTHOG_API_KEY'];
    optionalVars.forEach(key => {
      if (!process.env[key]) {
        log(`⚠️  ${key} not set (optional)`, colors.yellow);
      } else {
        log(`✅ ${key} is set`, colors.green);
      }
    });
  }

  // Check dependencies
  validateDependencies() {
    logSection('Dependencies Check');

    // Check if node_modules exists
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
      this.errors.push('node_modules not found. Run npm install first.');
      log(`❌ Dependencies not installed`, colors.red);
      return;
    }

    // Check for security vulnerabilities
    const auditResult = runCommand('npm audit --audit-level=high --json', false);
    if (!auditResult.success) {
      log(`⚠️  Could not run security audit`, colors.yellow);
    } else {
      try {
        const audit = JSON.parse(auditResult.output);
        if (audit.metadata && audit.metadata.vulnerabilities) {
          const { high, critical } = audit.metadata.vulnerabilities;
          if (critical > 0) {
            this.errors.push(`Found ${critical} critical security vulnerabilities`);
            log(`❌ Critical vulnerabilities found: ${critical}`, colors.red);
          } else if (high > 0) {
            this.warnings.push(`Found ${high} high security vulnerabilities`);
            log(`⚠️  High vulnerabilities found: ${high}`, colors.yellow);
          } else {
            log(`✅ No high or critical vulnerabilities`, colors.green);
          }
        }
      } catch (e) {
        log(`⚠️  Could not parse audit results`, colors.yellow);
      }
    }

    log(`✅ Dependencies installed`, colors.green);
  }

  // Check Prisma setup
  validatePrisma() {
    logSection('Prisma Database Setup');

    // Check if Prisma schema exists
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    if (!fs.existsSync(schemaPath)) {
      this.errors.push('Prisma schema not found at prisma/schema.prisma');
      log(`❌ Prisma schema not found`, colors.red);
      return;
    }
    log(`✅ Prisma schema found`, colors.green);

    // Check if Prisma client is generated
    const clientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
    if (!fs.existsSync(clientPath)) {
      log(`⚠️  Prisma client not generated, generating now...`, colors.yellow);
      const generateResult = runCommand('npx prisma generate', false);
      if (!generateResult.success) {
        this.errors.push('Failed to generate Prisma client');
        log(`❌ Failed to generate Prisma client`, colors.red);
      } else {
        log(`✅ Prisma client generated`, colors.green);
      }
    } else {
      log(`✅ Prisma client already generated`, colors.green);
    }

    // Check database connection (only if DATABASE_URL is set)
    if (process.env.DATABASE_URL) {
      log(`🔄 Testing database connection...`, colors.blue);
      const dbTest = runCommand('npx prisma db execute --preview-feature --stdin <<< "SELECT 1"', false);
      if (dbTest.success) {
        log(`✅ Database connection successful`, colors.green);
      } else {
        this.warnings.push('Could not connect to database');
        log(`⚠️  Could not connect to database`, colors.yellow);
      }
    }
  }

  // Run linting checks
  validateCode() {
    logSection('Code Quality Checks');

    // Run ESLint
    log(`🔄 Running ESLint...`, colors.blue);
    const lintResult = runCommand('npm run lint', false);
    if (!lintResult.success) {
      if (lintResult.error && lintResult.error.includes('warning')) {
        log(`⚠️  ESLint warnings found`, colors.yellow);
      } else {
        this.errors.push('ESLint errors found');
        log(`❌ ESLint errors found`, colors.red);
      }
    } else {
      log(`✅ ESLint checks passed`, colors.green);
    }

    // Run TypeScript type checking
    log(`🔄 Running TypeScript type check...`, colors.blue);
    const typeCheckResult = runCommand('npm run type-check', false);
    if (!typeCheckResult.success) {
      this.errors.push('TypeScript type errors found');
      log(`❌ TypeScript errors found`, colors.red);
    } else {
      log(`✅ TypeScript checks passed`, colors.green);
    }
  }

  // Check build configuration
  validateBuildConfig() {
    logSection('Build Configuration');

    // Check next.config.js
    const nextConfigPath = path.join(process.cwd(), 'next.config.js');
    if (!fs.existsSync(nextConfigPath)) {
      this.errors.push('next.config.js not found');
      log(`❌ next.config.js not found`, colors.red);
    } else {
      log(`✅ next.config.js found`, colors.green);

      // Check if ESLint is enabled during builds
      const configContent = fs.readFileSync(nextConfigPath, 'utf8');
      if (configContent.includes('ignoreDuringBuilds: true')) {
        this.warnings.push('ESLint is disabled during builds');
        log(`⚠️  ESLint disabled during builds`, colors.yellow);
      }
      if (configContent.includes('ignoreBuildErrors: true')) {
        this.warnings.push('TypeScript errors are ignored during builds');
        log(`⚠️  TypeScript errors ignored during builds`, colors.yellow);
      }
    }

    // Check for Netlify configuration
    const netlifyConfigPath = path.join(process.cwd(), 'netlify.toml');
    if (fs.existsSync(netlifyConfigPath)) {
      log(`✅ netlify.toml found`, colors.green);
    } else {
      log(`ℹ️  netlify.toml not found (okay if not using Netlify)`, colors.blue);
    }
  }

  // Check for required files and directories
  validateProjectStructure() {
    logSection('Project Structure');

    const requiredPaths = [
      { path: 'src/app', type: 'directory', description: 'App directory' },
      { path: 'public', type: 'directory', description: 'Public assets' },
      { path: 'prisma/schema.prisma', type: 'file', description: 'Prisma schema' },
      { path: 'package.json', type: 'file', description: 'Package configuration' },
      { path: 'tsconfig.json', type: 'file', description: 'TypeScript configuration' },
    ];

    requiredPaths.forEach(({ path: filePath, type, description }) => {
      const fullPath = path.join(process.cwd(), filePath);
      const exists = fs.existsSync(fullPath);

      if (!exists) {
        this.errors.push(`Missing ${type}: ${filePath} - ${description}`);
        log(`❌ Missing: ${filePath}`, colors.red);
      } else {
        const stat = fs.statSync(fullPath);
        const isCorrectType = type === 'directory' ? stat.isDirectory() : stat.isFile();
        if (!isCorrectType) {
          this.errors.push(`${filePath} should be a ${type}`);
          log(`❌ ${filePath} should be a ${type}`, colors.red);
        } else {
          log(`✅ Found: ${filePath}`, colors.green);
        }
      }
    });
  }

  // Run a test build
  testBuild() {
    if (process.env.SKIP_BUILD_TEST === 'true') {
      log(`ℹ️  Skipping test build (SKIP_BUILD_TEST=true)`, colors.blue);
      return;
    }

    logSection('Test Build');
    log(`🔄 Running test build...`, colors.blue);
    log(`This may take a few minutes...`, colors.blue);

    const buildResult = runCommand('npm run build', false);
    if (!buildResult.success) {
      this.errors.push('Build failed');
      log(`❌ Build failed`, colors.red);
      if (buildResult.error) {
        log(`Error: ${buildResult.error.substring(0, 500)}...`, colors.red);
      }
    } else {
      log(`✅ Build successful`, colors.green);
    }
  }

  // Generate validation report
  generateReport() {
    console.log();
    log(`═══════════════════════════════════════`, colors.magenta);
    log(`  VALIDATION REPORT`, colors.magenta);
    log(`═══════════════════════════════════════`, colors.magenta);
    console.log();

    const totalErrors = this.errors.length;
    const totalWarnings = this.warnings.length;

    if (totalErrors > 0) {
      log(`ERRORS (${totalErrors}):`, colors.red);
      this.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error}`, colors.red);
      });
      console.log();
    }

    if (totalWarnings > 0) {
      log(`WARNINGS (${totalWarnings}):`, colors.yellow);
      this.warnings.forEach((warning, index) => {
        log(`  ${index + 1}. ${warning}`, colors.yellow);
      });
      console.log();
    }

    if (totalErrors === 0 && totalWarnings === 0) {
      log(`✅ All checks passed successfully!`, colors.green);
      log(`Your project is ready for production build.`, colors.green);
    } else if (totalErrors === 0) {
      log(`⚠️  Build validation passed with ${totalWarnings} warning(s)`, colors.yellow);
      log(`The build can proceed, but you should address the warnings.`, colors.yellow);
    } else {
      log(`❌ Build validation failed with ${totalErrors} error(s)`, colors.red);
      log(`Please fix the errors before proceeding with the build.`, colors.red);
    }

    console.log();
    return totalErrors === 0;
  }

  // Run all validations
  async validate() {
    log(`🚀 Starting Build Validation...`, colors.cyan);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.cyan);

    this.validateNodeVersion();
    this.validateEnvironment();
    this.validateDependencies();
    this.validateProjectStructure();
    this.validatePrisma();
    this.validateBuildConfig();
    this.validateCode();

    // Only run test build if no errors so far
    if (this.errors.length === 0 && process.env.RUN_BUILD_TEST === 'true') {
      this.testBuild();
    }

    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Run validation
const validator = new BuildValidator();
validator.validate().catch(error => {
  log(`❌ Unexpected error during validation:`, colors.red);
  console.error(error);
  process.exit(1);
});