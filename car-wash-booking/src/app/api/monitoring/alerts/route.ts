/**
 * Alerts API Endpoint
 * GET /api/monitoring/alerts - Get alerts
 * POST /api/monitoring/alerts - Create alert
 * PUT /api/monitoring/alerts/:id - Update alert (acknowledge/resolve)
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertingSystem, Alert, AlertType, AlertSeverity, AlertSource } from '@/lib/alerting';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity') as AlertSeverity | null;
    const activeOnly = url.searchParams.get('active') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '100');

    let alerts: Alert[];

    if (activeOnly) {
      alerts = alertingSystem.getActiveAlerts(severity || undefined);
    } else {
      alerts = alertingSystem.getAllAlerts(limit);
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }
    }

    const summary = alertingSystem.getAlertSummary();

    return NextResponse.json({
      alerts,
      summary,
      total: alerts.length,
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      severity,
      title,
      message,
      source,
      details,
      tags,
    } = body;

    // Validate required fields
    if (!type || !severity || !title || !message || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: type, severity, title, message, source' },
        { status: 400 }
      );
    }

    // Validate enum values
    const validTypes: AlertType[] = [
      'health_check_failed',
      'high_error_rate',
      'slow_response',
      'high_memory_usage',
      'database_connection_failed',
      'external_service_down',
      'security_threat',
      'performance_degradation',
      'rate_limit_exceeded',
      'system_overload',
      'payment_failure',
      'booking_system_error',
    ];

    const validSeverities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
    const validSources: AlertSource[] = [
      'health_check',
      'api_monitoring',
      'performance_monitoring',
      'database_monitoring',
      'security_monitoring',
      'business_logic',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    const alert = alertingSystem.createAlert(
      type,
      severity,
      title,
      message,
      source,
      details,
      tags
    );

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Failed to create alert:', error);
    return NextResponse.json(
      {
        error: 'Failed to create alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const alertId = url.searchParams.get('id');
    const body = await request.json();
    const { action, acknowledgedBy, resolvedBy } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const alert = alertingSystem.getAlertById(alertId);
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    let success = false;
    let message = '';

    switch (action) {
      case 'acknowledge':
        success = alertingSystem.acknowledgeAlert(alertId, acknowledgedBy);
        message = success ? 'Alert acknowledged' : 'Alert already acknowledged';
        break;

      case 'resolve':
        success = alertingSystem.resolveAlert(alertId, resolvedBy);
        message = success ? 'Alert resolved' : 'Alert already resolved';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be "acknowledge" or "resolve"' },
          { status: 400 }
        );
    }

    const updatedAlert = alertingSystem.getAlertById(alertId);

    return NextResponse.json({
      success,
      message,
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('Failed to update alert:', error);
    return NextResponse.json(
      {
        error: 'Failed to update alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}