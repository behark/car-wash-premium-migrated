#!/usr/bin/env node
const { config } = require('dotenv');
const path = require('path');
const fetch = require('node-fetch');
const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');

// Load environment variables
config({ path: path.join(__dirname, '../.env.production.local') });
config({ path: path.join(__dirname, '../.env.local'), override: false });
config({ path: path.join(__dirname, '../.env'), override: false });

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class APIIntegrationTester {
  constructor() {
    this.results = [];
    this.siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kiiltoloisto.fi';
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  addResult(result) {
    this.results.push(result);
    const statusColor =
      result.status === 'success' ? colors.green :
      result.status === 'failed' ? colors.red :
      result.status === 'warning' ? colors.yellow :
      colors.cyan;

    const statusSymbol =
      result.status === 'success' ? '✅' :
      result.status === 'failed' ? '❌' :
      result.status === 'warning' ? '⚠️' :
      '🔧';

    this.log(`${statusSymbol} ${result.service}: ${result.message}`, statusColor);
    if (result.details) {
      console.log(`   Details:`, result.details);
    }
  }

  async testDatabase() {
    this.log('\n📊 Testing Database Connection (Supabase PostgreSQL)...', colors.bright);

    if (!process.env.DATABASE_URL) {
      this.addResult({
        service: 'Database',
        status: 'not_configured',
        message: 'DATABASE_URL not configured'
      });
      return;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as time, version() as version');
      const bookingsCount = await client.query('SELECT COUNT(*) FROM bookings');
      const servicesCount = await client.query('SELECT COUNT(*) FROM services');

      client.release();
      await pool.end();

      this.addResult({
        service: 'Database',
        status: 'success',
        message: 'Connected successfully to Supabase PostgreSQL',
        details: {
          version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
          bookings: bookingsCount.rows[0].count,
          services: servicesCount.rows[0].count,
          timestamp: result.rows[0].time
        }
      });
    } catch (error) {
      await pool.end();
      this.addResult({
        service: 'Database',
        status: 'failed',
        message: `Connection failed: ${error.message}`,
        details: { error: error.message, code: error.code }
      });
    }
  }

  async testSendGrid() {
    this.log('\n📧 Testing SendGrid Email Service...', colors.bright);

    const apiKey = process.env.SENDGRID_API_KEY;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
      this.addResult({
        service: 'SendGrid',
        status: 'not_configured',
        message: 'SENDGRID_API_KEY or SENDER_EMAIL not configured',
        details: {
          hasApiKey: !!apiKey,
          hasSenderEmail: !!senderEmail
        }
      });
      return;
    }

    if (apiKey === 'SG.test-key-placeholder' || !apiKey.startsWith('SG.')) {
      this.addResult({
        service: 'SendGrid',
        status: 'warning',
        message: 'SendGrid API key appears to be a placeholder',
        details: {
          apiKeyPrefix: apiKey.substring(0, 10),
          senderEmail
        }
      });
      return;
    }

    try {
      sgMail.setApiKey(apiKey);

      // Verify API key by checking account details
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const profile = await response.json();
        this.addResult({
          service: 'SendGrid',
          status: 'success',
          message: 'SendGrid API key is valid and working',
          details: {
            senderEmail,
            accountEmail: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name
          }
        });
      } else {
        this.addResult({
          service: 'SendGrid',
          status: 'failed',
          message: `SendGrid API key validation failed: ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        });
      }
    } catch (error) {
      this.addResult({
        service: 'SendGrid',
        status: 'failed',
        message: `SendGrid API error: ${error.message}`,
        details: {
          error: error.message
        }
      });
    }
  }

  async testStripe() {
    this.log('\n💳 Testing Stripe Payment Processing...', colors.bright);

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
      this.addResult({
        service: 'Stripe',
        status: 'not_configured',
        message: 'STRIPE_SECRET_KEY not configured'
      });
      return;
    }

    try {
      const Stripe = require('stripe');
      const stripe = new Stripe(secretKey, { apiVersion: '2022-11-15' });

      const isTestMode = secretKey.startsWith('sk_test_');

      // Verify API key
      const account = await stripe.accounts.retrieve();

      this.addResult({
        service: 'Stripe',
        status: 'success',
        message: `Stripe API connected (${isTestMode ? 'TEST' : 'LIVE'} mode)`,
        details: {
          mode: isTestMode ? 'test' : 'live',
          accountId: account.id,
          accountCountry: account.country,
          webhookSecret: !!webhookSecret
        }
      });
    } catch (error) {
      this.addResult({
        service: 'Stripe',
        status: 'failed',
        message: `Stripe API error: ${error.message}`,
        details: {
          type: error.type,
          code: error.code
        }
      });
    }
  }

  async testTwilio() {
    this.log('\n📱 Testing Twilio SMS Service...', colors.bright);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      this.addResult({
        service: 'Twilio',
        status: 'not_configured',
        message: 'Twilio credentials not fully configured',
        details: {
          hasAccountSid: !!accountSid,
          hasAuthToken: !!authToken,
          hasFromNumber: !!fromNumber
        }
      });
      return;
    }

    try {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      const account = await client.api.accounts(accountSid).fetch();

      this.addResult({
        service: 'Twilio',
        status: account.status === 'active' ? 'success' : 'warning',
        message: `Twilio account ${account.status}`,
        details: {
          accountStatus: account.status,
          accountName: account.friendlyName,
          fromNumber
        }
      });
    } catch (error) {
      this.addResult({
        service: 'Twilio',
        status: 'failed',
        message: `Twilio API error: ${error.message}`,
        details: {
          code: error.code,
          status: error.status
        }
      });
    }
  }

  async testNextAuth() {
    this.log('\n🔐 Testing NextAuth Configuration...', colors.bright);

    const nextAuthUrl = process.env.NEXTAUTH_URL;
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;

    if (!nextAuthUrl || !nextAuthSecret) {
      this.addResult({
        service: 'NextAuth',
        status: 'not_configured',
        message: 'NextAuth not fully configured',
        details: {
          hasUrl: !!nextAuthUrl,
          hasSecret: !!nextAuthSecret
        }
      });
      return;
    }

    const isSecretStrong = nextAuthSecret.length >= 32;

    this.addResult({
      service: 'NextAuth',
      status: isSecretStrong ? 'success' : 'warning',
      message: isSecretStrong
        ? 'NextAuth configured correctly'
        : 'NextAuth secret should be at least 32 characters',
      details: {
        url: nextAuthUrl,
        secretLength: nextAuthSecret.length,
        recommendedLength: 32
      }
    });
  }

  async testProductionEndpoints() {
    this.log('\n🌐 Testing Production API Endpoints...', colors.bright);

    const endpoints = [
      { path: '/api/health', method: 'GET', name: 'Health Check' },
      { path: '/api/bookings', method: 'GET', name: 'Bookings List' },
      { path: '/api/services', method: 'GET', name: 'Services List' },
      { path: '/.netlify/functions/bookings-list', method: 'GET', name: 'Netlify Function' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.siteUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          }
        });

        this.addResult({
          service: `Endpoint: ${endpoint.name}`,
          status: response.ok ? 'success' : 'warning',
          message: `${endpoint.method} ${endpoint.path} - Status: ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        });
      } catch (error) {
        this.addResult({
          service: `Endpoint: ${endpoint.name}`,
          status: 'failed',
          message: `Failed to reach endpoint: ${error.message}`
        });
      }
    }
  }

  generateReport() {
    this.log('\n' + '='.repeat(80), colors.bright);
    this.log('📋 API INTEGRATION VERIFICATION REPORT', colors.bright + colors.cyan);
    this.log('='.repeat(80), colors.bright);

    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      warning: this.results.filter(r => r.status === 'warning').length,
      notConfigured: this.results.filter(r => r.status === 'not_configured').length,
    };

    this.log('\n📊 Summary:', colors.bright);
    this.log(`  ✅ Success: ${summary.success}/${summary.total}`, colors.green);
    this.log(`  ❌ Failed: ${summary.failed}/${summary.total}`, colors.red);
    this.log(`  ⚠️  Warning: ${summary.warning}/${summary.total}`, colors.yellow);
    this.log(`  🔧 Not Configured: ${summary.notConfigured}/${summary.total}`, colors.cyan);

    const criticalIssues = this.results.filter(r => r.status === 'failed' || r.status === 'not_configured');
    if (criticalIssues.length > 0) {
      this.log('\n🚨 Critical Issues Requiring Attention:', colors.bright + colors.red);
      criticalIssues.forEach(issue => {
        this.log(`  • ${issue.service}: ${issue.message}`, colors.red);
      });
    }

    const warnings = this.results.filter(r => r.status === 'warning');
    if (warnings.length > 0) {
      this.log('\n⚠️  Warnings:', colors.bright + colors.yellow);
      warnings.forEach(warning => {
        this.log(`  • ${warning.service}: ${warning.message}`, colors.yellow);
      });
    }

    const successes = this.results.filter(r => r.status === 'success');
    if (successes.length > 0) {
      this.log('\n✅ Working Integrations:', colors.bright + colors.green);
      successes.forEach(success => {
        this.log(`  • ${success.service}`, colors.green);
      });
    }

    this.log('\n' + '='.repeat(80), colors.bright);
  }

  async runAllTests() {
    this.log('🚀 Starting API Integration Verification...', colors.bright + colors.blue);
    this.log(`📍 Testing against: ${this.siteUrl}`, colors.cyan);
    this.log('='.repeat(80), colors.bright);

    await this.testDatabase();
    await this.testSendGrid();
    await this.testStripe();
    await this.testTwilio();
    await this.testNextAuth();
    await this.testProductionEndpoints();

    this.generateReport();
  }
}

// Run tests
async function main() {
  const tester = new APIIntegrationTester();
  await tester.runAllTests();
}

main().catch(console.error);