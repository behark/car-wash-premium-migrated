#!/usr/bin/env ts-node
import { config } from 'dotenv';
import * as path from 'path';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';
import Stripe from 'stripe';
import twilio from 'twilio';
import { Pool } from 'pg';

// Load environment variables
config({ path: path.join(__dirname, '../.env.production.local') });
config({ path: path.join(__dirname, '../.env.local'), override: false });
config({ path: path.join(__dirname, '../.env'), override: false });

// ANSI color codes for better output
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

interface TestResult {
  service: string;
  status: 'success' | 'failed' | 'warning' | 'not_configured';
  message: string;
  details?: any;
}

class APIIntegrationTester {
  private results: TestResult[] = [];
  private siteUrl: string;

  constructor() {
    this.siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kiiltoloisto.fi';
  }

  private log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  private addResult(result: TestResult) {
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

  // Test Database Connection (Supabase PostgreSQL)
  async testDatabase(): Promise<void> {
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
          version: result.rows[0].version,
          bookings: bookingsCount.rows[0].count,
          services: servicesCount.rows[0].count,
          timestamp: result.rows[0].time
        }
      });
    } catch (error: any) {
      await pool.end();
      this.addResult({
        service: 'Database',
        status: 'failed',
        message: `Connection failed: ${error.message}`,
        details: { error: error.message, code: error.code }
      });
    }
  }

  // Test SendGrid Email Service
  async testSendGrid(): Promise<void> {
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

      // Test API key validity by sending a test email
      const msg = {
        to: senderEmail, // Send test email to sender address
        from: senderEmail,
        subject: 'API Integration Test - Kiiltoloisto',
        text: 'This is a test email from the API integration verification script.',
        html: '<p>This is a test email from the API integration verification script.</p>',
      };

      await sgMail.send(msg);

      this.addResult({
        service: 'SendGrid',
        status: 'success',
        message: 'SendGrid API configured and test email sent successfully',
        details: {
          senderEmail,
          testEmailSent: true
        }
      });
    } catch (error: any) {
      this.addResult({
        service: 'SendGrid',
        status: 'failed',
        message: `SendGrid API error: ${error.message}`,
        details: {
          code: error.code,
          response: error.response?.body
        }
      });
    }
  }

  // Test Stripe Payment Processing
  async testStripe(): Promise<void> {
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
      const stripe = new Stripe(secretKey, { apiVersion: '2022-11-15' as any });

      // Check if using test or live mode
      const isTestMode = secretKey.startsWith('sk_test_');

      // Verify API key by fetching account details
      const account = await stripe.accounts.retrieve();

      // Check webhook endpoint configuration
      const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      const productionWebhook = webhookEndpoints.data.find(ep =>
        ep.url.includes(this.siteUrl) || ep.url.includes('kiiltoloisto.fi')
      );

      this.addResult({
        service: 'Stripe',
        status: 'success',
        message: `Stripe API connected (${isTestMode ? 'TEST' : 'LIVE'} mode)`,
        details: {
          mode: isTestMode ? 'test' : 'live',
          accountId: account.id,
          accountCountry: account.country,
          webhookConfigured: !!productionWebhook,
          webhookUrl: productionWebhook?.url,
          webhookSecret: !!webhookSecret
        }
      });

      if (!productionWebhook) {
        this.addResult({
          service: 'Stripe Webhooks',
          status: 'warning',
          message: 'No webhook endpoint configured for production URL',
          details: {
            expectedUrl: `${this.siteUrl}/api/payment/webhook`,
            configuredEndpoints: webhookEndpoints.data.map(ep => ep.url)
          }
        });
      }
    } catch (error: any) {
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

  // Test Twilio SMS Service
  async testTwilio(): Promise<void> {
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
      const client = twilio(accountSid, authToken);

      // Verify account
      const account = await client.api.accounts(accountSid).fetch();

      // Check phone number ownership
      const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 10 });
      const hasConfiguredNumber = phoneNumbers.some(pn =>
        pn.phoneNumber === fromNumber
      );

      this.addResult({
        service: 'Twilio',
        status: account.status === 'active' ? 'success' : 'warning',
        message: `Twilio account ${account.status}`,
        details: {
          accountStatus: account.status,
          accountName: account.friendlyName,
          fromNumber,
          numberVerified: hasConfiguredNumber,
          availableNumbers: phoneNumbers.map(pn => pn.phoneNumber)
        }
      });

      if (!hasConfiguredNumber) {
        this.addResult({
          service: 'Twilio Phone Number',
          status: 'warning',
          message: `Configured number ${fromNumber} not found in account`,
          details: {
            configuredNumber: fromNumber,
            availableNumbers: phoneNumbers.map(pn => pn.phoneNumber)
          }
        });
      }
    } catch (error: any) {
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

  // Test NextAuth Configuration
  async testNextAuth(): Promise<void> {
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

    // Check if secret is strong enough
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

    // Test auth endpoint availability
    try {
      const response = await fetch(`${this.siteUrl}/api/auth/providers`);
      const providers = await response.json();

      this.addResult({
        service: 'NextAuth Endpoints',
        status: 'success',
        message: 'NextAuth endpoints accessible',
        details: { providers }
      });
    } catch (error: any) {
      this.addResult({
        service: 'NextAuth Endpoints',
        status: 'warning',
        message: 'Could not verify NextAuth endpoints',
        details: { error: error.message }
      });
    }
  }

  // Test Google Maps API
  async testGoogleMaps(): Promise<void> {
    this.log('\n🗺️ Testing Google Maps API...', colors.bright);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === '[YOUR-GOOGLE-MAPS-API-KEY]') {
      this.addResult({
        service: 'Google Maps',
        status: 'not_configured',
        message: 'Google Maps API key not configured',
        details: {
          hasApiKey: !!apiKey,
          isPlaceholder: apiKey === '[YOUR-GOOGLE-MAPS-API-KEY]'
        }
      });
      return;
    }

    try {
      // Test Geocoding API
      const testAddress = 'Mäkirinteentie 3, 00970 Helsinki, Finland';
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${apiKey}`;

      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status === 'OK') {
        this.addResult({
          service: 'Google Maps',
          status: 'success',
          message: 'Google Maps API key valid and working',
          details: {
            testAddress,
            results: data.results.length,
            location: data.results[0]?.geometry?.location
          }
        });
      } else {
        this.addResult({
          service: 'Google Maps',
          status: 'failed',
          message: `Google Maps API error: ${data.status}`,
          details: {
            status: data.status,
            errorMessage: data.error_message
          }
        });
      }
    } catch (error: any) {
      this.addResult({
        service: 'Google Maps',
        status: 'failed',
        message: `Failed to test Google Maps API: ${error.message}`
      });
    }
  }

  // Test Production Endpoints
  async testProductionEndpoints(): Promise<void> {
    this.log('\n🌐 Testing Production API Endpoints...', colors.bright);

    const endpoints = [
      { path: '/api/bookings', method: 'GET', name: 'Bookings List' },
      { path: '/api/services', method: 'GET', name: 'Services List' },
      { path: '/api/availability', method: 'POST', name: 'Availability Check' },
      { path: '/.netlify/functions/bookings-list', method: 'GET', name: 'Netlify Function - List' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.siteUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint.method === 'POST' ? JSON.stringify({
            date: new Date().toISOString().split('T')[0],
            serviceId: 1
          }) : undefined
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
      } catch (error: any) {
        this.addResult({
          service: `Endpoint: ${endpoint.name}`,
          status: 'failed',
          message: `Failed to reach endpoint: ${error.message}`
        });
      }
    }
  }

  // Generate comprehensive report
  generateReport(): void {
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

    // Critical Issues
    const criticalIssues = this.results.filter(r => r.status === 'failed' || r.status === 'not_configured');
    if (criticalIssues.length > 0) {
      this.log('\n🚨 Critical Issues Requiring Attention:', colors.bright + colors.red);
      criticalIssues.forEach(issue => {
        this.log(`  • ${issue.service}: ${issue.message}`, colors.red);
      });
    }

    // Warnings
    const warnings = this.results.filter(r => r.status === 'warning');
    if (warnings.length > 0) {
      this.log('\n⚠️  Warnings:', colors.bright + colors.yellow);
      warnings.forEach(warning => {
        this.log(`  • ${warning.service}: ${warning.message}`, colors.yellow);
      });
    }

    // Success
    const successes = this.results.filter(r => r.status === 'success');
    if (successes.length > 0) {
      this.log('\n✅ Working Integrations:', colors.bright + colors.green);
      successes.forEach(success => {
        this.log(`  • ${success.service}`, colors.green);
      });
    }

    this.log('\n' + '='.repeat(80), colors.bright);
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    this.log('🚀 Starting API Integration Verification...', colors.bright + colors.blue);
    this.log(`📍 Testing against: ${this.siteUrl}`, colors.cyan);
    this.log('='.repeat(80), colors.bright);

    await this.testDatabase();
    await this.testSendGrid();
    await this.testStripe();
    await this.testTwilio();
    await this.testNextAuth();
    await this.testGoogleMaps();
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