/**
 * Structured Logger with Correlation IDs
 * Enterprise-grade logging with distributed tracing and observability
 */

import { AsyncLocalStorage } from 'async_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  component?: string;
  service?: string;
  version?: string;
  environment?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    cause?: any;
  };
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpu?: NodeJS.CpuUsage;
  };
  tags?: string[];
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  version: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  fileConfig?: {
    filename: string;
    maxSize: number;
    maxFiles: number;
    datePattern?: string;
  };
  remoteConfig?: {
    endpoint: string;
    apiKey: string;
    batchSize: number;
    flushInterval: number;
  };
  formatters?: {
    console?: (entry: LogEntry) => string;
    file?: (entry: LogEntry) => string;
    remote?: (entry: LogEntry) => any;
  };
  filters?: Array<(entry: LogEntry) => boolean>;
  enrichers?: Array<(entry: LogEntry) => LogEntry>;
  sampling?: {
    debug?: number;
    info?: number;
    warn?: number;
    error?: number;
  };
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart: NodeJS.MemoryUsage;
  memoryEnd?: NodeJS.MemoryUsage;
  cpuStart: NodeJS.CpuUsage;
  cpuEnd?: NodeJS.CpuUsage;
}

/**
 * Enterprise structured logger with correlation ID support
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private config: LoggerConfig;
  private contextStorage = new AsyncLocalStorage<LogContext>();
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private performanceMetrics = new Map<string, PerformanceMetrics>();

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      service: process.env.SERVICE_NAME || 'car-wash-booking',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      ...config,
    };

    this.initializeLogger();
  }

  static getInstance(config?: Partial<LoggerConfig>): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(config);
    }
    return StructuredLogger.instance;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Partial<LogContext>): StructuredLogger {
    const childLogger = new StructuredLogger(this.config);
    childLogger.contextStorage = this.contextStorage;

    // Merge context
    const currentContext = this.getContext();
    const mergedContext = { ...currentContext, ...context };

    return childLogger.withContext(mergedContext);
  }

  /**
   * Execute function with correlation context
   */
  withContext<T>(context: LogContext, fn?: () => T): T | StructuredLogger {
    if (fn) {
      return this.contextStorage.run(context, fn);
    } else {
      // Return logger with context for chaining
      this.contextStorage.enterWith(context);
      return this;
    }
  }

  /**
   * Generate and set correlation ID
   */
  withCorrelationId(correlationId?: string): StructuredLogger {
    const id = correlationId || this.generateCorrelationId();
    return this.withContext({ ...this.getContext(), correlationId: id }) as StructuredLogger;
  }

  /**
   * Generate and set request ID
   */
  withRequestId(requestId?: string): StructuredLogger {
    const id = requestId || this.generateRequestId();
    return this.withContext({ ...this.getContext(), requestId: id }) as StructuredLogger;
  }

  /**
   * Set user context
   */
  withUser(userId: string, sessionId?: string): StructuredLogger {
    return this.withContext({
      ...this.getContext(),
      userId,
      sessionId,
    }) as StructuredLogger;
  }

  /**
   * Set operation context
   */
  withOperation(operation: string, component?: string): StructuredLogger {
    return this.withContext({
      ...this.getContext(),
      operation,
      component,
    }) as StructuredLogger;
  }

  /**
   * Set distributed tracing context
   */
  withTrace(traceId: string, spanId: string, parentSpanId?: string): StructuredLogger {
    return this.withContext({
      ...this.getContext(),
      traceId,
      spanId,
      parentSpanId,
    }) as StructuredLogger;
  }

  /**
   * Debug logging
   */
  debug(message: string, metadata?: Record<string, any>, tags?: string[]): void {
    this.log('debug', message, metadata, tags);
  }

  /**
   * Info logging
   */
  info(message: string, metadata?: Record<string, any>, tags?: string[]): void {
    this.log('info', message, metadata, tags);
  }

  /**
   * Warning logging
   */
  warn(message: string, metadata?: Record<string, any>, tags?: string[]): void {
    this.log('warn', message, metadata, tags);
  }

  /**
   * Error logging
   */
  error(message: string, error?: Error | any, metadata?: Record<string, any>, tags?: string[]): void {
    const errorInfo = this.serializeError(error);
    this.log('error', message, { ...metadata, error: errorInfo }, tags);
  }

  /**
   * Fatal logging
   */
  fatal(message: string, error?: Error | any, metadata?: Record<string, any>, tags?: string[]): void {
    const errorInfo = this.serializeError(error);
    this.log('fatal', message, { ...metadata, error: errorInfo }, tags);
  }

  /**
   * Start performance measurement
   */
  startPerformance(operationId: string): void {
    this.performanceMetrics.set(operationId, {
      startTime: Date.now(),
      memoryStart: process.memoryUsage(),
      cpuStart: process.cpuUsage(),
    });
  }

  /**
   * End performance measurement and log
   */
  endPerformance(
    operationId: string,
    message?: string,
    metadata?: Record<string, any>
  ): PerformanceMetrics | null {
    const metrics = this.performanceMetrics.get(operationId);
    if (!metrics) {
      this.warn('Performance metrics not found', { operationId });
      return null;
    }

    const endTime = Date.now();
    const memoryEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(metrics.cpuStart);

    const finalMetrics: PerformanceMetrics = {
      ...metrics,
      endTime,
      duration: endTime - metrics.startTime,
      memoryEnd,
      cpuEnd,
    };

    this.performanceMetrics.delete(operationId);

    this.info(
      message || `Performance: ${operationId}`,
      {
        ...metadata,
        performance: {
          duration: finalMetrics.duration,
          memoryUsage: {
            heapUsed: memoryEnd.heapUsed - metrics.memoryStart.heapUsed,
            heapTotal: memoryEnd.heapTotal - metrics.memoryStart.heapTotal,
            external: memoryEnd.external - metrics.memoryStart.external,
            rss: memoryEnd.rss - metrics.memoryStart.rss,
          },
          cpu: cpuEnd,
        },
      },
      ['performance']
    );

    return finalMetrics;
  }

  /**
   * Log function execution time
   */
  async measureAsync<T>(
    operationId: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startPerformance(operationId);

    try {
      const result = await fn();
      this.endPerformance(operationId, `Completed: ${operationId}`, metadata);
      return result;
    } catch (error) {
      this.endPerformance(operationId, `Failed: ${operationId}`, metadata);
      throw error;
    }
  }

  /**
   * Log function execution time (sync)
   */
  measure<T>(
    operationId: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.startPerformance(operationId);

    try {
      const result = fn();
      this.endPerformance(operationId, `Completed: ${operationId}`, metadata);
      return result;
    } catch (error) {
      this.endPerformance(operationId, `Failed: ${operationId}`, metadata);
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  audit(
    action: string,
    resource: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.info(
      `Audit: ${action} on ${resource}`,
      {
        ...metadata,
        audit: {
          action,
          resource,
          userId: userId || this.getContext().userId,
          timestamp: new Date().toISOString(),
        },
      },
      ['audit', action]
    );
  }

  /**
   * Create security log entry
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = severity === 'critical' ? 'fatal' :
                           severity === 'high' ? 'error' :
                           severity === 'medium' ? 'warn' : 'info';

    this.log(
      level,
      `Security: ${event}`,
      {
        ...metadata,
        security: {
          event,
          severity,
          timestamp: new Date().toISOString(),
        },
      },
      ['security', severity]
    );
  }

  /**
   * Flush logs immediately
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    if (this.config.enableRemote && this.config.remoteConfig) {
      await this.sendToRemote(logsToFlush);
    }
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return this.contextStorage.getStore() || {};
  }

  /**
   * Get logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private methods

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    tags?: string[]
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.config.service,
        version: this.config.version,
        environment: this.config.environment,
        ...this.getContext(),
      },
      metadata,
      tags,
    };

    // Apply enrichers
    const enrichedEntry = this.applyEnrichers(entry);

    // Apply filters
    if (!this.applyFilters(enrichedEntry)) return;

    // Apply sampling
    if (!this.shouldSample(level)) return;

    // Output to configured destinations
    this.outputLog(enrichedEntry);
  }

  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.levelPriority[this.config.level];
    const entryLevel = this.levelPriority[level];
    return entryLevel >= configLevel;
  }

  private shouldSample(level: LogLevel): boolean {
    const samplingRate = this.config.sampling?.[level];
    if (samplingRate === undefined) return true;
    return Math.random() < samplingRate;
  }

  private applyEnrichers(entry: LogEntry): LogEntry {
    if (!this.config.enrichers) return entry;

    return this.config.enrichers.reduce(
      (enrichedEntry, enricher) => enricher(enrichedEntry),
      entry
    );
  }

  private applyFilters(entry: LogEntry): boolean {
    if (!this.config.filters) return true;

    return this.config.filters.every(filter => filter(entry));
  }

  private outputLog(entry: LogEntry): void {
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    if (this.config.enableFile) {
      this.outputToFile(entry);
    }

    if (this.config.enableRemote) {
      this.bufferForRemote(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const formatter = this.config.formatters?.console || this.defaultConsoleFormatter;
    const formatted = formatter(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  private outputToFile(entry: LogEntry): void {
    // File output would be implemented with a file logging library
    // For now, we'll just log to console in development
    if (this.config.environment === 'development') {
      const formatter = this.config.formatters?.file || this.defaultFileFormatter;
      console.log(formatter(entry));
    }
  }

  private bufferForRemote(entry: LogEntry): void {
    this.logBuffer.push(entry);

    const batchSize = this.config.remoteConfig?.batchSize || 100;
    if (this.logBuffer.length >= batchSize) {
      this.flush();
    }

    // Set up flush timer if not already set
    if (!this.flushTimer) {
      const flushInterval = this.config.remoteConfig?.flushInterval || 5000;
      this.flushTimer = setTimeout(() => {
        this.flush();
        this.flushTimer = undefined;
      }, flushInterval);
    }
  }

  private async sendToRemote(entries: LogEntry[]): Promise<void> {
    if (!this.config.remoteConfig) return;

    try {
      const formatter = this.config.formatters?.remote || this.defaultRemoteFormatter;
      const payload = entries.map(formatter);

      // Remote logging implementation would go here
      // For now, we'll just log that we would send to remote
      console.log('Would send to remote:', {
        endpoint: this.config.remoteConfig.endpoint,
        count: entries.length,
      });
    } catch (error) {
      console.error('Failed to send logs to remote:', error);
    }
  }

  private serializeError(error?: Error | any): any {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.config.environment === 'development' ? error.stack : undefined,
        code: (error as any).code,
        cause: (error as any).cause,
      };
    }

    return error;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private initializeLogger(): void {
    // Set up graceful shutdown only in Node.js runtime (not Edge Runtime)
    if (typeof process !== 'undefined' && process.on) {
      try {
        process.on('SIGTERM', () => this.flush());
        process.on('SIGINT', () => this.flush());
        process.on('beforeExit', () => this.flush());
      } catch (error) {
        // Graceful degradation for environments that don't support process events
        console.warn('Process event handlers not available in this runtime environment');
      }
    }
  }

  // Default formatters

  private defaultConsoleFormatter = (entry: LogEntry): string => {
    const { timestamp, level, message, context, metadata } = entry;

    const contextStr = context.correlationId
      ? `[${context.correlationId}] `
      : '';

    const metadataStr = metadata
      ? ` ${JSON.stringify(metadata)}`
      : '';

    const levelStr = level.toUpperCase().padEnd(5);

    return `${timestamp} ${levelStr} ${contextStr}${message}${metadataStr}`;
  };

  private defaultFileFormatter = (entry: LogEntry): string => {
    return JSON.stringify(entry);
  };

  private defaultRemoteFormatter = (entry: LogEntry): any => {
    return entry;
  };
}

// Export singleton instance
export const structuredLogger = StructuredLogger.getInstance();