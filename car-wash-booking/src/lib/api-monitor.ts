import { logger } from './logger';

export interface APIHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  successRate: number;
  details?: any;
}

export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastError?: {
    timestamp: Date;
    message: string;
    code?: string;
  };
}

class APIMonitor {
  private static instance: APIMonitor;
  private healthStatus: Map<string, APIHealthStatus> = new Map();
  private metrics: Map<string, APIMetrics> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): APIMonitor {
    if (!APIMonitor.instance) {
      APIMonitor.instance = new APIMonitor();
    }
    return APIMonitor.instance;
  }

  private initializeServices() {
    const services = ['database', 'sendgrid', 'stripe', 'twilio', 'auth'];

    services.forEach(service => {
      this.healthStatus.set(service, {
        service,
        status: 'healthy',
        lastCheck: new Date(),
        errorCount: 0,
        successRate: 100
      });

      this.metrics.set(service, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      });

      this.circuitBreakers.set(service, new CircuitBreaker(service));
    });
  }

  async checkHealth(service: string): Promise<APIHealthStatus> {
    const startTime = Date.now();
    let status: APIHealthStatus = {
      service,
      status: 'healthy',
      lastCheck: new Date(),
      errorCount: 0,
      successRate: 100
    };

    try {
      switch (service) {
        case 'database':
          status = await this.checkDatabaseHealth();
          break;
        case 'sendgrid':
          status = await this.checkSendGridHealth();
          break;
        case 'stripe':
          status = await this.checkStripeHealth();
          break;
        case 'twilio':
          status = await this.checkTwilioHealth();
          break;
        case 'auth':
          status = await this.checkAuthHealth();
          break;
      }

      status.responseTime = Date.now() - startTime;
      this.healthStatus.set(service, status);

      logger.info(`Health check for ${service}`, status);

      return status;
    } catch (error: any) {
      status.status = 'down';
      status.details = { error: error.message };
      this.healthStatus.set(service, status);

      logger.error(`Health check failed for ${service}`, error);

      return status;
    }
  }

  private async checkDatabaseHealth(): Promise<APIHealthStatus> {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      await prisma.$disconnect();

      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        errorCount: 0,
        successRate: 100,
        details: { connected: true, responseTime }
      };
    } catch (error) {
      await prisma.$disconnect();
      throw error;
    }
  }

  private async checkSendGridHealth(): Promise<APIHealthStatus> {
    if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'SG.test-key-placeholder') {
      return {
        service: 'sendgrid',
        status: 'down',
        lastCheck: new Date(),
        errorCount: 0,
        successRate: 0,
        details: { configured: false }
      };
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      // SendGrid doesn't have a direct health endpoint, so we track based on recent usage
      const metrics = this.metrics.get('sendgrid');
      const successRate = metrics ?
        (metrics.successfulRequests / Math.max(metrics.totalRequests, 1)) * 100 : 100;

      return {
        service: 'sendgrid',
        status: successRate > 90 ? 'healthy' : successRate > 70 ? 'degraded' : 'down',
        lastCheck: new Date(),
        errorCount: metrics?.failedRequests || 0,
        successRate,
        details: { configured: true, metrics }
      };
    } catch (error) {
      throw error;
    }
  }

  private async checkStripeHealth(): Promise<APIHealthStatus> {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        service: 'stripe',
        status: 'down',
        lastCheck: new Date(),
        errorCount: 0,
        successRate: 0,
        details: { configured: false }
      };
    }

    try {
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const startTime = Date.now();
      await stripe.paymentIntents.list({ limit: 1 });
      const responseTime = Date.now() - startTime;

      return {
        service: 'stripe',
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        errorCount: 0,
        successRate: 100,
        details: { connected: true, responseTime }
      };
    } catch (error: any) {
      if (error.type === 'StripeAuthenticationError') {
        return {
          service: 'stripe',
          status: 'down',
          lastCheck: new Date(),
          errorCount: 1,
          successRate: 0,
          details: { error: 'Invalid API key' }
        };
      }
      throw error;
    }
  }

  private async checkTwilioHealth(): Promise<APIHealthStatus> {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return {
        service: 'twilio',
        status: 'down',
        lastCheck: new Date(),
        errorCount: 0,
        successRate: 0,
        details: { configured: false }
      };
    }

    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      const startTime = Date.now();
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      const responseTime = Date.now() - startTime;

      return {
        service: 'twilio',
        status: account.status === 'active' ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        errorCount: 0,
        successRate: 100,
        details: {
          accountStatus: account.status,
          responseTime
        }
      };
    } catch (error) {
      throw error;
    }
  }

  private async checkAuthHealth(): Promise<APIHealthStatus> {
    const hasSecret = !!process.env.NEXTAUTH_SECRET;
    const hasUrl = !!process.env.NEXTAUTH_URL;

    return {
      service: 'auth',
      status: hasSecret && hasUrl ? 'healthy' : 'down',
      lastCheck: new Date(),
      errorCount: 0,
      successRate: hasSecret && hasUrl ? 100 : 0,
      details: {
        hasSecret,
        hasUrl,
        url: process.env.NEXTAUTH_URL
      }
    };
  }

  recordRequest(service: string, success: boolean, responseTime: number) {
    const metrics = this.metrics.get(service) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average response time
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) /
      metrics.totalRequests;

    this.metrics.set(service, metrics);

    // Update circuit breaker
    const breaker = this.circuitBreakers.get(service);
    if (breaker) {
      if (success) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }
    }
  }

  recordError(service: string, error: any) {
    const metrics = this.metrics.get(service);
    if (metrics) {
      metrics.lastError = {
        timestamp: new Date(),
        message: error.message || 'Unknown error',
        code: error.code
      };
      this.metrics.set(service, metrics);
    }

    logger.error(`API error for ${service}`, {
      service,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }

  getHealthStatus(service?: string): APIHealthStatus | Map<string, APIHealthStatus> {
    if (service) {
      return this.healthStatus.get(service) || {
        service,
        status: 'down',
        lastCheck: new Date(),
        errorCount: 0,
        successRate: 0
      };
    }
    return this.healthStatus;
  }

  getMetrics(service?: string): APIMetrics | Map<string, APIMetrics> | undefined {
    if (service) {
      return this.metrics.get(service);
    }
    return this.metrics;
  }

  isServiceAvailable(service: string): boolean {
    const breaker = this.circuitBreakers.get(service);
    return breaker ? !breaker.isOpen() : false;
  }

  async getAllHealthStatuses(): Promise<APIHealthStatus[]> {
    const statuses: APIHealthStatus[] = [];

    for (const service of this.healthStatus.keys()) {
      const status = await this.checkHealth(service);
      statuses.push(status);
    }

    return statuses;
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime?: Date;
  private readonly threshold = 5; // failures before opening
  private readonly timeout = 60000; // 1 minute
  private readonly successThreshold = 3; // successes to close from half-open

  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.close();
      }
    } else if (this.state === 'closed') {
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.threshold) {
      this.open();
    }
  }

  isOpen(): boolean {
    if (this.state === 'open' && this.lastFailureTime) {
      const now = Date.now();
      const lastFailure = this.lastFailureTime.getTime();

      if (now - lastFailure >= this.timeout) {
        this.halfOpen();
        return false;
      }
    }

    return this.state === 'open';
  }

  private open() {
    this.state = 'open';
    logger.warn(`Circuit breaker opened for ${this.service}`);
  }

  private close() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    logger.info(`Circuit breaker closed for ${this.service}`);
  }

  private halfOpen() {
    this.state = 'half-open';
    this.successes = 0;
    logger.info(`Circuit breaker half-open for ${this.service}`);
  }
}

// Export singleton instance
export const apiMonitor = APIMonitor.getInstance();

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  service: string,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const startTime = Date.now();
      const result = await fn();
      const responseTime = Date.now() - startTime;

      apiMonitor.recordRequest(service, true, responseTime);
      return result;
    } catch (error: any) {
      lastError = error;
      apiMonitor.recordError(service, error);

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        logger.info(`Retrying ${service} after ${delay}ms (attempt ${i + 2}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  apiMonitor.recordRequest(service, false, 0);
  throw lastError;
}

// Fallback handler
export function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  service: string
): Promise<T> {
  return primaryFn().catch(error => {
    logger.warn(`Primary ${service} failed, using fallback`, { error: error.message });
    apiMonitor.recordError(service, error);
    return fallbackFn();
  });
}