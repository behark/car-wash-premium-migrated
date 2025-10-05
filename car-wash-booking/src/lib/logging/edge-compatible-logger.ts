/**
 * Edge Runtime Compatible Logger
 * Simplified logger for Edge Runtime environments (middleware, edge functions)
 */

export type EdgeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface EdgeLogEntry {
  timestamp: string;
  level: EdgeLogLevel;
  message: string;
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Lightweight logger for Edge Runtime compatibility
 */
export class EdgeCompatibleLogger {
  private static instance: EdgeCompatibleLogger;

  static getInstance(): EdgeCompatibleLogger {
    if (!EdgeCompatibleLogger.instance) {
      EdgeCompatibleLogger.instance = new EdgeCompatibleLogger();
    }
    return EdgeCompatibleLogger.instance;
  }

  /**
   * Debug logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, metadata);
    }
  }

  /**
   * Info logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Warning logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Error logging
   */
  error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } : error;

    this.log('error', message, { ...metadata, error: errorInfo });
  }

  /**
   * Create child logger with context
   */
  child(context: { correlationId?: string; requestId?: string; [key: string]: any }) {
    const childLogger = new EdgeCompatibleLogger();
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  private context: Record<string, any> = {};

  private log(level: EdgeLogLevel, message: string, metadata?: Record<string, any>): void {
    const entry: EdgeLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.context.correlationId,
      requestId: this.context.requestId,
      metadata: { ...this.context, ...metadata },
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
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
        console.error(formatted);
        break;
    }
  }

  private formatEntry(entry: EdgeLogEntry): string {
    const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
    const metadataStr = entry.metadata && Object.keys(entry.metadata).length > 0
      ? ` ${JSON.stringify(entry.metadata)}`
      : '';

    return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} ${correlationStr}${entry.message}${metadataStr}`;
  }
}

// Export singleton for Edge Runtime use
export const edgeLogger = EdgeCompatibleLogger.getInstance();