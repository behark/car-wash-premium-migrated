/**
 * Automation Engine - Inspired by TastyIgniter's Automation System
 * Handles automated actions based on booking lifecycle events
 */

import { prisma } from './prisma';
import { AutomationEvent, BookingStatus } from '@prisma/client';
import { bookingEvents } from './booking-manager';
import { sendEmail } from './mail';
import { sendSMS } from './sms';
import { differenceInHours, addHours } from 'date-fns';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface AutomationAction {
  type: 'email' | 'sms' | 'push' | 'webhook' | 'statusChange';
  config: {
    templateId?: string;
    recipient?: string;
    subject?: string;
    message?: string;
    url?: string;
    newStatus?: BookingStatus;
  };
}

export interface AutomationRuleData {
  name: string;
  description?: string;
  eventType: AutomationEvent;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  isActive?: boolean;
  priority?: number;
}

/**
 * Create a new automation rule
 */
export async function createAutomationRule(data: AutomationRuleData) {
  return await prisma.automationRule.create({
    data: {
      name: data.name,
      description: data.description,
      eventType: data.eventType,
      conditions: JSON.stringify(data.conditions || []),
      actions: JSON.stringify(data.actions),
      isActive: data.isActive !== false,
      priority: data.priority || 0,
    },
  });
}

/**
 * Execute automation rules for a specific event
 */
export async function executeAutomationRules(
  eventType: AutomationEvent,
  eventData: any
): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: {
      eventType,
      isActive: true,
    },
    orderBy: {
      priority: 'desc',
    },
  });

  for (const rule of rules) {
    try {
      const conditions = JSON.parse(rule.conditions || '[]') as AutomationCondition[];
      const actions = JSON.parse(rule.actions) as AutomationAction[];

      // Check if all conditions are met
      const conditionsMet = evaluateConditions(conditions, eventData);

      if (conditionsMet) {
        // Execute all actions
        const results = await executeActions(actions, eventData);

        // Log execution
        await prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            bookingId: eventData.booking?.id || eventData.bookingId,
            status: 'success',
            result: JSON.stringify(results),
          },
        });
      } else {
        // Log skipped execution
        await prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            bookingId: eventData.booking?.id || eventData.bookingId,
            status: 'skipped',
            result: JSON.stringify({ reason: 'Conditions not met' }),
          },
        });
      }
    } catch (error: any) {
      console.error(`Automation rule ${rule.id} execution failed:`, error);

      // Log failed execution
      await prisma.automationExecution.create({
        data: {
          ruleId: rule.id,
          bookingId: eventData.booking?.id || eventData.bookingId,
          status: 'failed',
          errorMessage: error.message,
        },
      });
    }
  }
}

/**
 * Evaluate conditions against event data
 */
function evaluateConditions(
  conditions: AutomationCondition[],
  eventData: any
): boolean {
  if (conditions.length === 0) {
    return true; // No conditions means always execute
  }

  return conditions.every(condition => {
    const value = getNestedValue(eventData, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'notEquals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Execute automation actions
 */
async function executeActions(
  actions: AutomationAction[],
  eventData: any
): Promise<any[]> {
  const results = [];

  for (const action of actions) {
    try {
      let result;

      switch (action.type) {
        case 'email':
          result = await executeEmailAction(action, eventData);
          break;
        case 'sms':
          result = await executeSMSAction(action, eventData);
          break;
        case 'push':
          result = await executePushAction(action, eventData);
          break;
        case 'webhook':
          result = await executeWebhookAction(action, eventData);
          break;
        case 'statusChange':
          result = await executeStatusChangeAction(action, eventData);
          break;
        default:
          result = { success: false, error: 'Unknown action type' };
      }

      results.push({ action: action.type, result });
    } catch (error: any) {
      results.push({ action: action.type, error: error.message });
    }
  }

  return results;
}

/**
 * Execute email action
 */
async function executeEmailAction(
  action: AutomationAction,
  eventData: any
): Promise<any> {
  const booking = eventData.booking;

  if (!booking) {
    throw new Error('No booking data available for email action');
  }

  const recipient = action.config.recipient || booking.customerEmail;
  const subject = replacePlaceholders(action.config.subject || 'Booking Update', booking);
  const message = replacePlaceholders(action.config.message || '', booking);

  return await sendEmail({
    to: recipient,
    subject,
    text: message,
    html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
  });
}

/**
 * Execute SMS action
 */
async function executeSMSAction(
  action: AutomationAction,
  eventData: any
): Promise<any> {
  const booking = eventData.booking;

  if (!booking) {
    throw new Error('No booking data available for SMS action');
  }

  const recipient = action.config.recipient || booking.customerPhone;
  const message = replacePlaceholders(action.config.message || '', booking);

  return await sendSMS(recipient, message);
}

/**
 * Execute push notification action
 */
async function executePushAction(
  action: AutomationAction,
  eventData: any
): Promise<any> {
  const booking = eventData.booking;

  if (!booking) {
    throw new Error('No booking data available for push action');
  }

  // Find user's push subscriptions
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      customerEmail: booking.customerEmail,
      isActive: true,
    },
  });

  const results = [];

  for (const subscription of subscriptions) {
    try {
      await prisma.pushNotification.create({
        data: {
          subscriptionId: subscription.id,
          bookingId: booking.id,
          type: 'STATUS_UPDATE',
          title: replacePlaceholders(action.config.subject || 'Booking Update', booking),
          body: replacePlaceholders(action.config.message || '', booking),
          status: 'PENDING',
        },
      });

      results.push({ subscriptionId: subscription.id, status: 'queued' });
    } catch (error: any) {
      results.push({ subscriptionId: subscription.id, error: error.message });
    }
  }

  return results;
}

/**
 * Execute webhook action
 */
async function executeWebhookAction(
  action: AutomationAction,
  eventData: any
): Promise<any> {
  const url = action.config.url;

  if (!url) {
    throw new Error('Webhook URL not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
  };
}

/**
 * Execute status change action
 */
async function executeStatusChangeAction(
  action: AutomationAction,
  eventData: any
): Promise<any> {
  const booking = eventData.booking;

  if (!booking) {
    throw new Error('No booking data available for status change action');
  }

  if (!action.config.newStatus) {
    throw new Error('New status not configured');
  }

  return await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: action.config.newStatus as BookingStatus,
    },
  });
}

/**
 * Replace placeholders in templates
 */
function replacePlaceholders(template: string, booking: any): string {
  return template
    .replace(/\{customerName\}/g, booking.customerName || '')
    .replace(/\{confirmationCode\}/g, booking.confirmationCode || '')
    .replace(/\{date\}/g, booking.date ? new Date(booking.date).toLocaleDateString() : '')
    .replace(/\{startTime\}/g, booking.startTime || '')
    .replace(/\{endTime\}/g, booking.endTime || '')
    .replace(/\{serviceName\}/g, booking.service?.titleFi || '')
    .replace(/\{price\}/g, booking.priceCents ? `${(booking.priceCents / 100).toFixed(2)}€` : '')
    .replace(/\{status\}/g, booking.status || '')
    .replace(/\{vehicleType\}/g, booking.vehicleType || '')
    .replace(/\{licensePlate\}/g, booking.licensePlate || '');
}

/**
 * Initialize automation engine
 * Sets up event listeners for booking events
 */
export function initializeAutomationEngine() {
  // Booking created event
  bookingEvents.on('booking.created', async (eventData) => {
    await executeAutomationRules(AutomationEvent.BOOKING_CREATED, eventData);
  });

  // Booking confirmed event (status changed to CONFIRMED)
  bookingEvents.on('booking.statusChanged', async (eventData) => {
    if (eventData.newStatus === BookingStatus.CONFIRMED) {
      await executeAutomationRules(AutomationEvent.BOOKING_CONFIRMED, eventData);
    } else if (eventData.newStatus === BookingStatus.CANCELLED) {
      await executeAutomationRules(AutomationEvent.BOOKING_CANCELLED, eventData);
    } else if (eventData.newStatus === BookingStatus.COMPLETED) {
      await executeAutomationRules(AutomationEvent.BOOKING_COMPLETED, eventData);
    } else if (eventData.newStatus === BookingStatus.NO_SHOW) {
      await executeAutomationRules(AutomationEvent.BOOKING_NO_SHOW, eventData);
    }

    // General status changed event
    await executeAutomationRules(AutomationEvent.BOOKING_STATUS_CHANGED, eventData);
  });

  // Booking assigned event
  bookingEvents.on('booking.assigned', async (eventData) => {
    await executeAutomationRules(AutomationEvent.BOOKING_ASSIGNED, eventData);
  });

  // Booking cancelled event
  bookingEvents.on('booking.cancelled', async (eventData) => {
    await executeAutomationRules(AutomationEvent.BOOKING_CANCELLED, eventData);
  });

  console.log('Automation engine initialized');
}

/**
 * Setup default automation rules
 */
export async function setupDefaultAutomationRules() {
  const existingRules = await prisma.automationRule.count();

  if (existingRules > 0) {
    console.log('Automation rules already exist, skipping setup');
    return;
  }

  // Rule 1: Send confirmation email on booking creation
  await createAutomationRule({
    name: 'Send Booking Confirmation Email',
    description: 'Automatically send confirmation email when a booking is created',
    eventType: AutomationEvent.BOOKING_CREATED,
    actions: [
      {
        type: 'email',
        config: {
          subject: 'Booking Confirmation - {confirmationCode}',
          message: `Hi {customerName},

Your car wash booking has been confirmed!

Booking Details:
- Confirmation Code: {confirmationCode}
- Date: {date}
- Time: {startTime} - {endTime}
- Service: {serviceName}
- Price: {price}
- Vehicle: {vehicleType} ({licensePlate})

We look forward to serving you!

Best regards,
Kiilto & Loisto Team`,
        },
      },
    ],
    priority: 10,
  });

  // Rule 2: Send reminder 24 hours before booking
  await createAutomationRule({
    name: 'Send 24h Booking Reminder',
    description: 'Send reminder notification 24 hours before booking',
    eventType: AutomationEvent.REMINDER_24H,
    actions: [
      {
        type: 'email',
        config: {
          subject: 'Reminder: Your car wash appointment tomorrow',
          message: `Hi {customerName},

This is a friendly reminder about your car wash appointment tomorrow.

Booking Details:
- Date: {date}
- Time: {startTime}
- Service: {serviceName}
- Confirmation Code: {confirmationCode}

See you soon!

Best regards,
Kiilto & Loisto Team`,
        },
      },
      {
        type: 'sms',
        config: {
          message: 'Reminder: Your car wash appointment tomorrow at {startTime}. Code: {confirmationCode}',
        },
      },
    ],
    priority: 5,
  });

  // Rule 3: Send cancellation confirmation
  await createAutomationRule({
    name: 'Send Cancellation Confirmation',
    description: 'Send confirmation when booking is cancelled',
    eventType: AutomationEvent.BOOKING_CANCELLED,
    actions: [
      {
        type: 'email',
        config: {
          subject: 'Booking Cancelled - {confirmationCode}',
          message: `Hi {customerName},

Your booking has been cancelled as requested.

Cancelled Booking Details:
- Confirmation Code: {confirmationCode}
- Date: {date}
- Time: {startTime}
- Service: {serviceName}

If you'd like to book again, please visit our website.

Best regards,
Kiilto & Loisto Team`,
        },
      },
    ],
    priority: 8,
  });

  // Rule 4: Send completion confirmation
  await createAutomationRule({
    name: 'Send Completion Confirmation',
    description: 'Send thank you message when service is completed',
    eventType: AutomationEvent.BOOKING_COMPLETED,
    actions: [
      {
        type: 'email',
        config: {
          subject: 'Thank you for choosing Kiilto & Loisto!',
          message: `Hi {customerName},

Thank you for choosing our car wash service!

We hope you're satisfied with our service. Your vehicle is now sparkling clean!

Booking Details:
- Service: {serviceName}
- Date: {date}
- Price: {price}

We'd love to hear your feedback. Please leave us a review!

Best regards,
Kiilto & Loisto Team`,
        },
      },
    ],
    priority: 5,
  });

  console.log('Default automation rules created successfully');
}
