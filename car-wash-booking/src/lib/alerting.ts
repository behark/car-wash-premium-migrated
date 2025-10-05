/**
 * Alerting and Notifications System
 * Handles system alerts, notifications, and escalation procedures
 */

import { trackEvent, trackError } from './monitoring-init';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  source: AlertSource;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  tags: string[];
}

export type AlertType =
  | 'health_check_failed'
  | 'high_error_rate'
  | 'slow_response'
  | 'high_memory_usage'
  | 'database_connection_failed'
  | 'external_service_down'
  | 'security_threat'
  | 'performance_degradation'
  | 'rate_limit_exceeded'
  | 'system_overload'
  | 'payment_failure'
  | 'booking_system_error';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertSource =
  | 'health_check'
  | 'api_monitoring'
  | 'performance_monitoring'
  | 'database_monitoring'
  | 'security_monitoring'
  | 'business_logic';

export interface AlertChannel {
  name: string;
  type: 'email' | 'webhook' | 'console' | 'push_notification';
  enabled: boolean;
  config: Record<string, any>;
  severityThreshold: AlertSeverity;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  alertType: AlertType;
  severity: AlertSeverity;
  source: AlertSource;
  enabled: boolean;
  cooldownMinutes: number;
  escalationDelayMinutes: number;
}

class AlertingSystem {
  private static instance: AlertingSystem;
  private alerts: Map<string, Alert> = new Map();
  private channels: AlertChannel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private rules: AlertRule[] = [];
  private cooldowns: Map<string, Date> = new Map();

  private constructor() {
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
  }

  static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem();
    }
    return AlertingSystem.instance;
  }

  private initializeDefaultChannels(): void {
    // Console logging (always enabled for development)
    this.channels.push({
      name: 'console',
      type: 'console',
      enabled: true,
      config: {},
      severityThreshold: 'low',
    });

    // Email alerts (production only)
    if (process.env.NODE_ENV === 'production' && process.env.ALERT_EMAIL) {
      this.channels.push({
        name: 'email',
        type: 'email',
        enabled: true,
        config: {
          to: process.env.ALERT_EMAIL,
          from: process.env.SMTP_FROM || 'alerts@carwash.fi',
        },
        severityThreshold: 'high',
      });
    }

    // Webhook alerts
    if (process.env.ALERT_WEBHOOK_URL) {
      this.channels.push({
        name: 'webhook',
        type: 'webhook',
        enabled: true,
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_TOKEN || '',
          },
        },
        severityThreshold: 'medium',
      });
    }
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'high_error_rate',
        name: 'High API Error Rate',
        condition: (data) => data.errorRate > 20,
        alertType: 'high_error_rate',
        severity: 'high',
        source: 'api_monitoring',
        enabled: true,
        cooldownMinutes: 15,
        escalationDelayMinutes: 30,
      },
      {
        id: 'slow_response',
        name: 'Slow API Response',
        condition: (data) => data.averageResponseTime > 5000,
        alertType: 'slow_response',
        severity: 'medium',
        source: 'api_monitoring',
        enabled: true,
        cooldownMinutes: 10,
        escalationDelayMinutes: 20,
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        condition: (data) => data.memoryUsage > 90,
        alertType: 'high_memory_usage',
        severity: 'medium',
        source: 'health_check',
        enabled: true,
        cooldownMinutes: 5,
        escalationDelayMinutes: 15,
      },
      {
        id: 'database_connection_failed',
        name: 'Database Connection Failed',
        condition: (data) => data.databaseStatus === 'fail',
        alertType: 'database_connection_failed',
        severity: 'critical',
        source: 'health_check',
        enabled: true,
        cooldownMinutes: 1,
        escalationDelayMinutes: 5,
      },
      {
        id: 'performance_degradation',
        name: 'Performance Degradation',
        condition: (data) => data.lcp > 4000 || data.fid > 300,
        alertType: 'performance_degradation',
        severity: 'medium',
        source: 'performance_monitoring',
        enabled: true,
        cooldownMinutes: 30,
        escalationDelayMinutes: 60,
      },
    ];
  }

  createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    source: AlertSource,
    details?: Record<string, any>,
    tags: string[] = []
  ): Alert {
    const id = this.generateAlertId(type, source);

    // Check cooldown
    const cooldownKey = `${type}_${source}`;
    const lastAlert = this.cooldowns.get(cooldownKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < 60000) {
      // Skip if within 1-minute cooldown
      return this.alerts.get(id)!;
    }

    const alert: Alert = {
      id,
      type,
      severity,
      title,
      message,
      details,
      timestamp: new Date(),
      source,
      acknowledged: false,
      resolved: false,
      escalated: false,
      tags,
    };

    this.alerts.set(id, alert);
    this.cooldowns.set(cooldownKey, new Date());

    // Send notifications
    this.sendNotifications(alert);

    // Track alert creation
    trackEvent('alert_created', {
      alert_type: type,
      severity,
      source,
      tags,
    });

    console.log(`[ALERT] ${severity.toUpperCase()}: ${title}`, {
      message,
      details,
      source,
    });

    return alert;
  }

  private generateAlertId(type: AlertType, source: AlertSource): string {
    return `${type}_${source}_${Date.now()}`;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const applicableChannels = this.channels.filter(
      channel => channel.enabled && this.shouldSendToChannel(channel, alert)
    );

    await Promise.all(
      applicableChannels.map(channel => this.sendToChannel(channel, alert))
    );
  }

  private shouldSendToChannel(channel: AlertChannel, alert: Alert): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityLevels[alert.severity] >= severityLevels[channel.severityThreshold];
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'console':
          this.sendConsoleNotification(alert);
          break;
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        case 'push_notification':
          await this.sendPushNotification(channel, alert);
          break;
      }
    } catch (error) {
      console.error(`Failed to send alert to ${channel.name}:`, error);
      trackError(error instanceof Error ? error : new Error(String(error)), {
        channel: channel.name,
        alert_id: alert.id,
      });
    }
  }

  private sendConsoleNotification(alert: Alert): void {
    const emoji = this.getSeverityEmoji(alert.severity);
    console.log(`\n${emoji} [${alert.severity.toUpperCase()}] ${alert.title}`);
    console.log(`📝 ${alert.message}`);
    console.log(`📍 Source: ${alert.source}`);
    console.log(`🕐 Time: ${alert.timestamp.toISOString()}`);
    if (alert.details) {
      console.log(`📊 Details:`, alert.details);
    }
    console.log(`🆔 Alert ID: ${alert.id}\n`);
  }

  private async sendEmailNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid not configured for email alerts');
      return;
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const emoji = this.getSeverityEmoji(alert.severity);
    const html = `
      <h2>${emoji} System Alert: ${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
      <p><strong>Source:</strong> ${alert.source}</p>
      <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      ${alert.details ? `<pre>${JSON.stringify(alert.details, null, 2)}</pre>` : ''}
      <hr>
      <p><small>Alert ID: ${alert.id}</small></p>
    `;

    await sgMail.send({
      to: channel.config.to,
      from: channel.config.from,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html,
    });
  }

  private async sendWebhookNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    const payload = {
      alert_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      source: alert.source,
      timestamp: alert.timestamp.toISOString(),
      details: alert.details,
      tags: alert.tags,
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: channel.config.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  private async sendPushNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    // Implementation would depend on chosen push notification service
    console.log('Push notification not implemented yet');
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    const emojis = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥',
    };
    return emojis[severity];
  }

  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.acknowledged) {
      return false;
    }

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);

    trackEvent('alert_acknowledged', {
      alert_id: alertId,
      alert_type: alert.type,
      acknowledged_by: acknowledgedBy,
    });

    return true;
  }

  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.alerts.set(alertId, alert);

    trackEvent('alert_resolved', {
      alert_id: alertId,
      alert_type: alert.type,
      resolved_by: resolvedBy,
      duration_minutes: Math.round(
        (alert.resolvedAt.getTime() - alert.timestamp.getTime()) / 60000
      ),
    });

    return true;
  }

  getActiveAlerts(severity?: AlertSeverity): Alert[] {
    const alerts = Array.from(this.alerts.values()).filter(
      alert => !alert.resolved
    );

    if (severity) {
      return alerts.filter(alert => alert.severity === severity);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  getAllAlerts(limit = 100): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getAlertById(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getAlertSummary(): {
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    bySource: Record<AlertSource, number>;
  } {
    const alerts = Array.from(this.alerts.values());

    const summary = {
      total: alerts.length,
      active: alerts.filter(a => !a.resolved).length,
      acknowledged: alerts.filter(a => a.acknowledged && !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<AlertSeverity, number>,
      bySource: {} as Record<AlertSource, number>,
    };

    alerts.forEach(alert => {
      summary.bySeverity[alert.severity]++;
      summary.bySource[alert.source] = (summary.bySource[alert.source] || 0) + 1;
    });

    return summary;
  }

  // Automated alert checking based on monitoring data
  checkAlerts(monitoringData: {
    health?: any;
    api?: any;
    performance?: any;
    database?: any;
  }): void {
    if (monitoringData.health) {
      this.checkHealthAlerts(monitoringData.health);
    }

    if (monitoringData.api) {
      this.checkAPIAlerts(monitoringData.api);
    }

    if (monitoringData.performance) {
      this.checkPerformanceAlerts(monitoringData.performance);
    }

    if (monitoringData.database) {
      this.checkDatabaseAlerts(monitoringData.database);
    }
  }

  private checkHealthAlerts(health: any): void {
    if (health.status === 'unhealthy') {
      this.createAlert(
        'health_check_failed',
        'critical',
        'System Health Check Failed',
        'One or more critical health checks have failed',
        'health_check',
        { health_status: health },
        ['system', 'health']
      );
    }

    if (health.environment?.memory?.percentage > 90) {
      this.createAlert(
        'high_memory_usage',
        'medium',
        'High Memory Usage Detected',
        `Memory usage is at ${health.environment.memory.percentage}%`,
        'health_check',
        { memory_usage: health.environment.memory },
        ['performance', 'memory']
      );
    }
  }

  private checkAPIAlerts(api: any): void {
    if (api.errorRate > 20) {
      this.createAlert(
        'high_error_rate',
        'high',
        'High API Error Rate',
        `API error rate is ${api.errorRate.toFixed(1)}%`,
        'api_monitoring',
        { api_stats: api },
        ['api', 'errors']
      );
    }

    if (api.averageResponseTime > 5000) {
      this.createAlert(
        'slow_response',
        'medium',
        'Slow API Response Time',
        `Average response time is ${api.averageResponseTime.toFixed(0)}ms`,
        'api_monitoring',
        { api_stats: api },
        ['api', 'performance']
      );
    }
  }

  private checkPerformanceAlerts(performance: any): void {
    if (performance.lcp && performance.lcp > 4000) {
      this.createAlert(
        'performance_degradation',
        'medium',
        'Poor Largest Contentful Paint',
        `LCP is ${performance.lcp.toFixed(0)}ms (threshold: 4000ms)`,
        'performance_monitoring',
        { performance_metrics: performance },
        ['performance', 'web-vitals']
      );
    }
  }

  private checkDatabaseAlerts(database: any): void {
    if (database.status === 'fail') {
      this.createAlert(
        'database_connection_failed',
        'critical',
        'Database Connection Failed',
        'Unable to connect to the database',
        'database_monitoring',
        { database_status: database },
        ['database', 'connection']
      );
    }
  }
}

// Export singleton instance
export const alertingSystem = AlertingSystem.getInstance();

// Convenience functions
export function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  source: AlertSource,
  details?: Record<string, any>,
  tags?: string[]
): Alert {
  return alertingSystem.createAlert(type, severity, title, message, source, details, tags);
}

export function acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
  return alertingSystem.acknowledgeAlert(alertId, acknowledgedBy);
}

export function resolveAlert(alertId: string, resolvedBy?: string): boolean {
  return alertingSystem.resolveAlert(alertId, resolvedBy);
}

export function getActiveAlerts(severity?: AlertSeverity): Alert[] {
  return alertingSystem.getActiveAlerts(severity);
}

export function getAlertSummary() {
  return alertingSystem.getAlertSummary();
}