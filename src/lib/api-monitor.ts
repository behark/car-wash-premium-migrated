/**
 * API Monitor Module
 * Provides monitoring and retry capabilities for API calls
 */

import { logger } from './logger';

export interface ApiCall {
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  error?: string;
  retryCount?: number;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

class ApiMonitor {
  private static instance: ApiMonitor;
  private activeCalls: Map<string, ApiCall> = new Map();
  private callHistory: ApiCall[] = [];
  private readonly maxHistorySize = 1000;
  private serviceStatus: Map<string, boolean> = new Map();

  static getInstance(): ApiMonitor {
    if (!ApiMonitor.instance) {
      ApiMonitor.instance = new ApiMonitor();
    }
    return ApiMonitor.instance;
  }

  startCall(callId: string, endpoint: string, method: string): void {
    const call: ApiCall = {
      endpoint,
      method,
      startTime: Date.now(),
    };
    this.activeCalls.set(callId, call);
  }

  endCall(callId: string, success: boolean, error?: string): void {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.endTime = Date.now();
      call.success = success;
      call.error = error;

      // Add to history
      this.callHistory.push({ ...call });
      if (this.callHistory.length > this.maxHistorySize) {
        this.callHistory.shift();
      }

      // Remove from active calls
      this.activeCalls.delete(callId);

      // Log performance metrics
      const duration = call.endTime - call.startTime;
      if (success) {
        logger.info(`API call completed: ${call.method} ${call.endpoint} (${duration}ms)`);
      } else {
        logger.error(`API call failed: ${call.method} ${call.endpoint} (${duration}ms) - ${error}`);
      }
    }
  }

  getMetrics() {
    const total = this.callHistory.length;
    const successful = this.callHistory.filter(call => call.success).length;
    const failed = total - successful;
    const avgDuration = total > 0
      ? this.callHistory.reduce((sum, call) =>
          sum + ((call.endTime || call.startTime) - call.startTime), 0) / total
      : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration,
      activeCalls: this.activeCalls.size,
    };
  }

  getCallHistory(): ApiCall[] {
    return [...this.callHistory];
  }

  isServiceAvailable(serviceName: string): boolean {
    return this.serviceStatus.get(serviceName) !== false;
  }

  setServiceStatus(serviceName: string, available: boolean): void {
    this.serviceStatus.set(serviceName, available);
  }

  markServiceDown(serviceName: string): void {
    this.setServiceStatus(serviceName, false);
    logger.warn(`Service marked as down: ${serviceName}`);
  }

  markServiceUp(serviceName: string): void {
    this.setServiceStatus(serviceName, true);
    logger.info(`Service marked as up: ${serviceName}`);
  }
}

export const apiMonitor = ApiMonitor.getInstance();

/**
 * Retry a function with exponential backoff
 * Supports both new signature with options object and legacy signature with individual parameters
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  serviceNameOrOptions: string | RetryOptions = {},
  maxRetries?: number,
  baseDelay?: number
): Promise<T> {
  let options: RetryOptions;

  // Handle legacy signature: fn, serviceName, maxRetries, baseDelay
  if (typeof serviceNameOrOptions === 'string') {
    options = {
      maxRetries: maxRetries || 3,
      baseDelay: baseDelay || 1000,
    };
  } else {
    // New signature: fn, options
    options = serviceNameOrOptions;
  }

  const {
    maxRetries: retries = 3,
    baseDelay: delay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`Operation succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt === retries) {
        logger.error(`Operation failed after ${retries} retries: ${lastError.message}`);
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const retryDelay = Math.min(
        delay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      logger.warn(`Operation failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${retryDelay}ms: ${lastError.message}`);

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError!;
}

/**
 * Create a monitored API call wrapper
 */
export function monitoredApiCall<T>(
  endpoint: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const callId = `${method}-${endpoint}-${Date.now()}-${Math.random()}`;

  apiMonitor.startCall(callId, endpoint, method);

  return fn()
    .then(result => {
      apiMonitor.endCall(callId, true);
      return result;
    })
    .catch(error => {
      apiMonitor.endCall(callId, false, error.message);
      throw error;
    });
}

export default {
  apiMonitor,
  retryWithBackoff,
  monitoredApiCall,
};