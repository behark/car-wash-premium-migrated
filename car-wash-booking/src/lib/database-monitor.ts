/**
 * Database Monitoring and Health Check Service
 * Provides real-time monitoring, alerting, and performance metrics
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { logger } from './logger';
import nodemailer from 'nodemailer';

interface DatabaseMetrics {
  timestamp: Date;
  responseTime: number;
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  slowQueries: SlowQuery[];
  cacheHitRatio: number;
  databaseSizeMB: number;
  tableMetrics: TableMetric[];
  errorCount: number;
  lastError?: string;
  health: 'healthy' | 'degraded' | 'critical';
}

interface SlowQuery {
  query: string;
  meanTime: number;
  calls: number;
  totalTime: number;
}

interface TableMetric {
  tableName: string;
  rowCount: number;
  sizeMB: number;
  deadTuples: number;
  lastVacuum?: Date;
  lastAutoVacuum?: Date;
}

interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: any;
  timestamp: Date;
  resolved: boolean;
}

type AlertType =
  | 'SLOW_RESPONSE'
  | 'HIGH_CONNECTION_USAGE'
  | 'LOW_CACHE_HIT_RATIO'
  | 'DATABASE_SIZE_WARNING'
  | 'SLOW_QUERY_DETECTED'
  | 'TABLE_BLOAT'
  | 'HEALTH_CHECK_FAILED'
  | 'DEADLOCK_DETECTED'
  | 'REPLICATION_LAG';

export class DatabaseMonitor extends EventEmitter {
  private prisma: PrismaClient;
  private metrics: DatabaseMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private emailTransporter?: nodemailer.Transporter;

  // Thresholds for alerting
  private readonly thresholds = {
    responseTime: 1000, // ms
    connectionUsage: 0.8, // 80%
    cacheHitRatio: 0.9, // 90%
    databaseSizeGB: 10, // GB
    slowQueryTime: 100, // ms
    tableBloatRatio: 0.2, // 20%
    replicationLagSeconds: 10,
  };

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.setupEmailTransporter();
  }

  /**
   * Setup email transporter for critical alerts
   */
  private setupEmailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Start monitoring with specified interval
   */
  startMonitoring(intervalMs: number = 60000) {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info(`Starting database monitoring with ${intervalMs}ms interval`);

    // Initial check
    this.checkHealth().catch(error => {
      logger.error('Initial health check failed', error);
    });

    // Schedule regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkHealth().catch(error => {
        logger.error('Scheduled health check failed', error);
      });
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Database monitoring stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<DatabaseMetrics> {
    const startTime = Date.now();
    const metrics: DatabaseMetrics = {
      timestamp: new Date(),
      responseTime: 0,
      connectionCount: 0,
      activeConnections: 0,
      idleConnections: 0,
      slowQueries: [],
      cacheHitRatio: 0,
      databaseSizeMB: 0,
      tableMetrics: [],
      errorCount: 0,
      health: 'healthy',
    };

    try {
      // 1. Test database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      metrics.responseTime = Date.now() - startTime;

      // 2. Check connection pool status
      const connectionStats = await this.getConnectionStats();
      metrics.connectionCount = connectionStats.total;
      metrics.activeConnections = connectionStats.active;
      metrics.idleConnections = connectionStats.idle;

      // 3. Check for slow queries
      metrics.slowQueries = await this.getSlowQueries();

      // 4. Get cache hit ratio
      metrics.cacheHitRatio = await this.getCacheHitRatio();

      // 5. Get database size
      metrics.databaseSizeMB = await this.getDatabaseSize();

      // 6. Get table metrics
      metrics.tableMetrics = await this.getTableMetrics();

      // 7. Determine health status
      metrics.health = this.determineHealthStatus(metrics);

      // 8. Check for alerts
      await this.checkAlerts(metrics);

      // Store metrics
      this.metrics.push(metrics);
      if (this.metrics.length > 1440) {
        // Keep last 24 hours at 1-minute intervals
        this.metrics.shift();
      }

      this.emit('metrics', metrics);
      return metrics;
    } catch (error) {
      metrics.errorCount++;
      metrics.lastError = error instanceof Error ? error.message : String(error);
      metrics.health = 'critical';

      this.createAlert({
        id: 'health-check-failed',
        type: 'HEALTH_CHECK_FAILED',
        severity: 'critical',
        message: 'Database health check failed',
        metadata: { error: metrics.lastError },
        timestamp: new Date(),
        resolved: false,
      });

      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  private async getConnectionStats(): Promise<{
    total: number;
    active: number;
    idle: number;
    idleInTransaction: number;
  }> {
    const result = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        active: bigint;
        idle: bigint;
        idle_in_transaction: bigint;
      }>
    >`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const stats = result[0];
    return {
      total: Number(stats.total),
      active: Number(stats.active),
      idle: Number(stats.idle),
      idleInTransaction: Number(stats.idle_in_transaction),
    };
  }

  /**
   * Get slow queries from pg_stat_statements
   */
  private async getSlowQueries(): Promise<SlowQuery[]> {
    try {
      const queries = await this.prisma.$queryRaw<
        Array<{
          query: string;
          calls: bigint;
          total_time: number;
          mean_time: number;
          max_time: number;
        }>
      >`
        SELECT
          query,
          calls,
          total_time,
          mean_time,
          max_time
        FROM pg_stat_statements
        WHERE mean_time > ${this.thresholds.slowQueryTime}
          AND query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_time DESC
        LIMIT 10
      `;

      return queries.map(q => ({
        query: q.query.substring(0, 200), // Truncate long queries
        meanTime: q.mean_time,
        calls: Number(q.calls),
        totalTime: q.total_time,
      }));
    } catch (error) {
      // pg_stat_statements might not be installed
      logger.debug('Could not fetch slow queries', error);
      return [];
    }
  }

  /**
   * Get cache hit ratio
   */
  private async getCacheHitRatio(): Promise<number> {
    const result = await this.prisma.$queryRaw<
      Array<{
        ratio: number;
      }>
    >`
      SELECT
        CASE
          WHEN (sum(heap_blks_hit) + sum(heap_blks_read)) = 0 THEN 1
          ELSE ROUND(
            sum(heap_blks_hit)::numeric /
            (sum(heap_blks_hit) + sum(heap_blks_read))::numeric,
            4
          )
        END as ratio
      FROM pg_statio_user_tables
    `;

    return result[0]?.ratio || 0;
  }

  /**
   * Get database size in MB
   */
  private async getDatabaseSize(): Promise<number> {
    const result = await this.prisma.$queryRaw<
      Array<{
        size_mb: number;
      }>
    >`
      SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb
    `;

    return result[0]?.size_mb || 0;
  }

  /**
   * Get metrics for each table
   */
  private async getTableMetrics(): Promise<TableMetric[]> {
    const tables = await this.prisma.$queryRaw<
      Array<{
        table_name: string;
        row_count: bigint;
        size_mb: number;
        dead_tuples: bigint;
        last_vacuum: Date | null;
        last_autovacuum: Date | null;
      }>
    >`
      SELECT
        schemaname || '.' || tablename as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(schemaname || '.' || tablename) / 1024 / 1024 as size_mb,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 20
    `;

    return tables.map(t => ({
      tableName: t.table_name,
      rowCount: Number(t.row_count),
      sizeMB: t.size_mb,
      deadTuples: Number(t.dead_tuples),
      lastVacuum: t.last_vacuum || undefined,
      lastAutoVacuum: t.last_autovacuum || undefined,
    }));
  }

  /**
   * Determine overall health status based on metrics
   */
  private determineHealthStatus(metrics: DatabaseMetrics): 'healthy' | 'degraded' | 'critical' {
    const issues = [];

    if (metrics.responseTime > this.thresholds.responseTime) {
      issues.push('slow_response');
    }

    if (metrics.activeConnections / metrics.connectionCount > this.thresholds.connectionUsage) {
      issues.push('high_connection_usage');
    }

    if (metrics.cacheHitRatio < this.thresholds.cacheHitRatio) {
      issues.push('low_cache_hit_ratio');
    }

    if (metrics.databaseSizeMB > this.thresholds.databaseSizeGB * 1024) {
      issues.push('database_size_warning');
    }

    if (metrics.slowQueries.length > 5) {
      issues.push('many_slow_queries');
    }

    if (issues.length === 0) {
      return 'healthy';
    } else if (issues.length <= 2) {
      return 'degraded';
    } else {
      return 'critical';
    }
  }

  /**
   * Check for alert conditions and create/resolve alerts
   */
  private async checkAlerts(metrics: DatabaseMetrics) {
    // Check response time
    if (metrics.responseTime > this.thresholds.responseTime) {
      this.createAlert({
        id: 'slow-response',
        type: 'SLOW_RESPONSE',
        severity: metrics.responseTime > this.thresholds.responseTime * 2 ? 'high' : 'medium',
        message: `Database response time is ${metrics.responseTime}ms`,
        metadata: { responseTime: metrics.responseTime },
        timestamp: new Date(),
        resolved: false,
      });
    } else {
      this.resolveAlert('slow-response');
    }

    // Check connection usage
    const connectionUsage = metrics.activeConnections / metrics.connectionCount;
    if (connectionUsage > this.thresholds.connectionUsage) {
      this.createAlert({
        id: 'high-connections',
        type: 'HIGH_CONNECTION_USAGE',
        severity: connectionUsage > 0.9 ? 'critical' : 'high',
        message: `Connection pool usage at ${Math.round(connectionUsage * 100)}%`,
        metadata: {
          active: metrics.activeConnections,
          total: metrics.connectionCount,
        },
        timestamp: new Date(),
        resolved: false,
      });
    } else {
      this.resolveAlert('high-connections');
    }

    // Check cache hit ratio
    if (metrics.cacheHitRatio < this.thresholds.cacheHitRatio) {
      this.createAlert({
        id: 'low-cache-hit',
        type: 'LOW_CACHE_HIT_RATIO',
        severity: 'medium',
        message: `Cache hit ratio is ${Math.round(metrics.cacheHitRatio * 100)}%`,
        metadata: { cacheHitRatio: metrics.cacheHitRatio },
        timestamp: new Date(),
        resolved: false,
      });
    } else {
      this.resolveAlert('low-cache-hit');
    }

    // Check for table bloat
    for (const table of metrics.tableMetrics) {
      if (table.rowCount > 0) {
        const bloatRatio = table.deadTuples / table.rowCount;
        if (bloatRatio > this.thresholds.tableBloatRatio) {
          this.createAlert({
            id: `table-bloat-${table.tableName}`,
            type: 'TABLE_BLOAT',
            severity: 'low',
            message: `Table ${table.tableName} has ${Math.round(bloatRatio * 100)}% dead tuples`,
            metadata: {
              table: table.tableName,
              deadTuples: table.deadTuples,
              liveTuples: table.rowCount,
            },
            timestamp: new Date(),
            resolved: false,
          });
        } else {
          this.resolveAlert(`table-bloat-${table.tableName}`);
        }
      }
    }
  }

  /**
   * Create or update an alert
   */
  private async createAlert(alert: Alert) {
    const existingAlert = this.alerts.get(alert.id);

    if (!existingAlert || existingAlert.resolved) {
      this.alerts.set(alert.id, alert);
      this.emit('alert', alert);

      // Send notifications for high/critical alerts
      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.sendAlertNotification(alert);
      }

      logger.warn(`Alert created: ${alert.type}`, {
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata,
      });
    }
  }

  /**
   * Resolve an alert if it exists
   */
  private resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.emit('alert-resolved', alert);
      logger.info(`Alert resolved: ${alert.type}`);
    }
  }

  /**
   * Send alert notification via email
   */
  private async sendAlertNotification(alert: Alert) {
    if (!this.emailTransporter || !process.env.ALERT_EMAIL) {
      return;
    }

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@carwash.fi',
        to: process.env.ALERT_EMAIL,
        subject: `[${alert.severity.toUpperCase()}] Database Alert: ${alert.type}`,
        html: `
          <h2>Database Alert</h2>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
          ${alert.metadata ? `<pre>${JSON.stringify(alert.metadata, null, 2)}</pre>` : ''}
        `,
      });
    } catch (error) {
      logger.error('Failed to send alert email', error);
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): DatabaseMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 60): DatabaseMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Run maintenance tasks
   */
  async runMaintenance() {
    logger.info('Running database maintenance tasks');

    try {
      // Vacuum analyze main tables
      await this.prisma.$executeRaw`VACUUM ANALYZE "Booking"`;
      await this.prisma.$executeRaw`VACUUM ANALYZE "Service"`;
      await this.prisma.$executeRaw`VACUUM ANALYZE "TimeSlot"`;

      // Update statistics
      await this.prisma.$executeRaw`ANALYZE`;

      // Reindex if needed
      const tables = ['Booking', 'Service', 'TimeSlot'];
      for (const table of tables) {
        const bloat = await this.prisma.$queryRaw<
          Array<{ bloat_ratio: number }>
        >`
          SELECT
            CASE
              WHEN n_live_tup = 0 THEN 0
              ELSE ROUND(n_dead_tup::numeric / n_live_tup::numeric, 4)
            END as bloat_ratio
          FROM pg_stat_user_tables
          WHERE tablename = ${table}
        `;

        if (bloat[0]?.bloat_ratio > 0.5) {
          logger.info(`Reindexing table ${table} due to high bloat`);
          await this.prisma.$executeRaw`REINDEX TABLE "${table}"`;
        }
      }

      logger.info('Database maintenance completed');
    } catch (error) {
      logger.error('Database maintenance failed', error);
      throw error;
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportPrometheusMetrics(): string {
    const current = this.getCurrentMetrics();
    if (!current) {
      return '';
    }

    const lines = [
      `# HELP db_response_time_ms Database response time in milliseconds`,
      `# TYPE db_response_time_ms gauge`,
      `db_response_time_ms ${current.responseTime}`,
      '',
      `# HELP db_connections_total Total database connections`,
      `# TYPE db_connections_total gauge`,
      `db_connections_total ${current.connectionCount}`,
      '',
      `# HELP db_connections_active Active database connections`,
      `# TYPE db_connections_active gauge`,
      `db_connections_active ${current.activeConnections}`,
      '',
      `# HELP db_cache_hit_ratio Database cache hit ratio`,
      `# TYPE db_cache_hit_ratio gauge`,
      `db_cache_hit_ratio ${current.cacheHitRatio}`,
      '',
      `# HELP db_size_mb Database size in megabytes`,
      `# TYPE db_size_mb gauge`,
      `db_size_mb ${current.databaseSizeMB}`,
      '',
      `# HELP db_slow_queries_total Number of slow queries`,
      `# TYPE db_slow_queries_total gauge`,
      `db_slow_queries_total ${current.slowQueries.length}`,
    ];

    return lines.join('\n');
  }
}

// Create singleton instance
let monitorInstance: DatabaseMonitor | null = null;

export function getDatabaseMonitor(prisma: PrismaClient): DatabaseMonitor {
  if (!monitorInstance) {
    monitorInstance = new DatabaseMonitor(prisma);
  }
  return monitorInstance;
}