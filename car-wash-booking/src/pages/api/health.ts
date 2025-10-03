import type { NextApiRequest, NextApiResponse } from 'next';
import { apiMonitor } from '../../lib/api-monitor';
import { getEnvironmentConfig, validateEnvironment } from '../../lib/envConfig';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get environment configuration status
    const envConfig = getEnvironmentConfig();
    const envValidation = validateEnvironment();

    // Check health of all services
    const healthStatuses = await apiMonitor.getAllHealthStatuses();

    // Get metrics for all services
    const metrics = apiMonitor.getMetrics();

    // Calculate overall system health
    const totalServices = healthStatuses.length;
    const healthyServices = healthStatuses.filter(s => s.status === 'healthy').length;
    const degradedServices = healthStatuses.filter(s => s.status === 'degraded').length;
    const downServices = healthStatuses.filter(s => s.status === 'down').length;

    const overallHealth =
      downServices > 0 ? 'unhealthy' :
      degradedServices > 0 ? 'degraded' :
      'healthy';

    const healthScore = (healthyServices / totalServices) * 100;

    // Build response
    const response = {
      status: overallHealth,
      healthScore: Math.round(healthScore),
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: envConfig.app.nodeEnv,
        netlifyContext: envConfig.app.netlifyContext,
        siteUrl: envConfig.app.siteUrl,
        isValid: envValidation.isValid,
        missingConfigs: envValidation.missing,
        warnings: envValidation.warnings
      },
      services: {
        healthy: healthyServices,
        degraded: degradedServices,
        down: downServices,
        total: totalServices,
        details: healthStatuses.map(status => ({
          service: status.service,
          status: status.status,
          responseTime: status.responseTime,
          successRate: status.successRate,
          lastCheck: status.lastCheck,
          details: status.details
        }))
      },
      integrations: {
        database: {
          configured: envConfig.database.isConfigured,
          status: healthStatuses.find(s => s.service === 'database')?.status || 'unknown'
        },
        email: {
          configured: envConfig.email.isConfigured,
          status: healthStatuses.find(s => s.service === 'sendgrid')?.status || 'unknown',
          provider: 'SendGrid',
          senderEmail: envConfig.email.senderEmail || 'Not configured'
        },
        payment: {
          configured: !!process.env.STRIPE_SECRET_KEY,
          status: healthStatuses.find(s => s.service === 'stripe')?.status || 'unknown',
          provider: 'Stripe',
          mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' :
                process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'not configured'
        },
        sms: {
          configured: envConfig.sms.isConfigured,
          status: healthStatuses.find(s => s.service === 'twilio')?.status || 'unknown',
          provider: 'Twilio',
          fromNumber: envConfig.sms.fromNumber || 'Not configured'
        },
        auth: {
          configured: envConfig.auth.isConfigured,
          status: healthStatuses.find(s => s.service === 'auth')?.status || 'unknown',
          provider: 'NextAuth'
        }
      },
      metrics: Array.from(metrics as Map<string, any>).map(([service, data]) => ({
        service,
        ...data
      })),
      recommendations: generateRecommendations(healthStatuses, envValidation)
    };

    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Return appropriate status code based on health
    const statusCode = overallHealth === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check system health',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function generateRecommendations(healthStatuses: any[], envValidation: any): string[] {
  const recommendations: string[] = [];

  // Check for missing configurations
  if (envValidation.missing.length > 0) {
    recommendations.push(`Configure missing environment variables: ${envValidation.missing.join(', ')}`);
  }

  // Check for placeholder values
  if (process.env.SENDGRID_API_KEY === 'SG.test-key-placeholder') {
    recommendations.push('Replace SendGrid placeholder API key with actual key');
  }

  // Check for services that are down
  healthStatuses.forEach(status => {
    if (status.status === 'down') {
      switch (status.service) {
        case 'sendgrid':
          recommendations.push('Configure SendGrid API key and verify domain authentication');
          break;
        case 'stripe':
          recommendations.push('Configure Stripe API keys and webhook endpoint');
          break;
        case 'twilio':
          recommendations.push('Configure Twilio credentials and purchase phone number');
          break;
        case 'database':
          recommendations.push('Check database connection string and network connectivity');
          break;
      }
    } else if (status.status === 'degraded') {
      recommendations.push(`Investigate performance issues with ${status.service}`);
    }
  });

  // Check for test mode in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      recommendations.push('Switch Stripe from test mode to live mode for production');
    }
  }

  // Check for security recommendations
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    recommendations.push('Use a longer NEXTAUTH_SECRET (minimum 32 characters)');
  }

  return recommendations;
}