/**
 * Server-Side Push Notifications
 * Handles sending push notifications using web-push library
 */

import webpush from 'web-push';
import { prisma } from '../prisma';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@kiiltoloisto.fi';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  renotify?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface ScheduledNotification {
  subscriptionId: number;
  bookingId?: number;
  type: string;
  payload: PushNotificationPayload;
  scheduledFor?: Date;
}

/**
 * Send push notification to a specific subscription
 */
export async function sendPushNotification(
  subscriptionId: number,
  payload: PushNotificationPayload,
  options: {
    bookingId?: number;
    type?: string;
    scheduledFor?: Date;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get subscription from database
    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: subscriptionId, isActive: true },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found or inactive' };
    }

    // Create push subscription object for web-push
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // Create notification record
    const notification = await prisma.pushNotification.create({
      data: {
        subscriptionId,
        bookingId: options.bookingId,
        type: (options.type || 'CUSTOM') as any,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        image: payload.image,
        data: payload.data || {},
        actions: payload.actions || [],
        scheduledFor: options.scheduledFor,
        status: options.scheduledFor ? 'PENDING' : 'SENT',
      },
    });

    // If scheduled for future, don't send now
    if (options.scheduledFor && options.scheduledFor > new Date()) {
      return { success: true };
    }

    // Send the notification
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        urgency: 'normal',
        TTL: 24 * 60 * 60, // 24 hours
      }
    );

    // Update notification status
    await prisma.pushNotification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Update subscription last used
    await prisma.pushSubscription.update({
      where: { id: subscriptionId },
      data: { lastUsed: new Date() },
    });

    return { success: true };

  } catch (error: any) {
    console.error('Failed to send push notification:', error);

    // If subscription is invalid, mark as inactive
    if (error.statusCode === 410 || error.statusCode === 404) {
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });
    }

    // Update notification status
    if (options.type) {
      await prisma.pushNotification.updateMany({
        where: {
          subscriptionId,
          type: options.type as any,
          status: 'PENDING',
        },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          attempts: { increment: 1 },
        },
      });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple subscriptions
 */
export async function sendBulkPushNotifications(
  subscriptionIds: number[],
  payload: PushNotificationPayload,
  options: {
    type?: string;
    scheduledFor?: Date;
  } = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Send notifications in batches to avoid overwhelming the system
  const batchSize = 100;
  for (let i = 0; i < subscriptionIds.length; i += batchSize) {
    const batch = subscriptionIds.slice(i, i + batchSize);

    const promises = batch.map(async (subscriptionId) => {
      const result = await sendPushNotification(subscriptionId, payload, options);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`ID ${subscriptionId}: ${result.error}`);
        }
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + batchSize < subscriptionIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Send push notification to all subscribers with specific email
 */
export async function sendPushNotificationToEmail(
  customerEmail: string,
  payload: PushNotificationPayload,
  options: {
    bookingId?: number;
    type?: string;
    scheduledFor?: Date;
  } = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  // Get all active subscriptions for this email
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      customerEmail,
      isActive: true,
    },
    select: { id: true },
  });

  const subscriptionIds = subscriptions.map(sub => sub.id);

  if (subscriptionIds.length === 0) {
    return { success: 0, failed: 0, errors: ['No active subscriptions found'] };
  }

  return sendBulkPushNotifications(subscriptionIds, payload, options);
}

/**
 * Send push notification to all active subscribers
 */
export async function sendPushNotificationToAll(
  payload: PushNotificationPayload,
  options: {
    type?: string;
    scheduledFor?: Date;
    excludeEmails?: string[];
  } = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  // Get all active subscriptions
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      isActive: true,
      ...(options.excludeEmails && {
        customerEmail: {
          notIn: options.excludeEmails,
        },
      }),
    },
    select: { id: true },
  });

  const subscriptionIds = subscriptions.map(sub => sub.id);

  if (subscriptionIds.length === 0) {
    return { success: 0, failed: 0, errors: ['No active subscriptions found'] };
  }

  return sendBulkPushNotifications(subscriptionIds, payload, options);
}

/**
 * Schedule booking reminders
 */
export async function scheduleBookingReminder(
  bookingId: number,
  customerEmail: string,
  reminderHours: number = 24
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Calculate reminder time
  const reminderTime = new Date(booking.startTime);
  reminderTime.setHours(reminderTime.getHours() - reminderHours);

  // Don't schedule if reminder time is in the past
  if (reminderTime <= new Date()) {
    return;
  }

  // Create notification payload
  const payload: PushNotificationPayload = {
    title: 'Autopesu muistutus',
    body: `${booking.service.titleFi} alkaa ${reminderHours}h kuluttua`,
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    data: {
      bookingId,
      type: 'reminder',
      url: `/booking/confirmation?id=${booking.confirmationCode}`,
    },
    actions: [
      {
        action: 'view',
        title: 'Näytä varaus',
        icon: '/icons/icon-72x72.svg',
      },
      {
        action: 'directions',
        title: 'Reittiohjeet',
      },
    ],
  };

  await sendPushNotificationToEmail(customerEmail, payload, {
    bookingId,
    type: 'BOOKING_REMINDER',
    scheduledFor: reminderTime,
  });
}

/**
 * Send booking confirmation notification
 */
export async function sendBookingConfirmation(
  bookingId: number,
  customerEmail: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const payload: PushNotificationPayload = {
    title: 'Varaus vahvistettu!',
    body: `${booking.service.titleFi} - ${new Date(booking.startTime).toLocaleDateString('fi-FI')}`,
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    data: {
      bookingId,
      type: 'confirmation',
      url: `/booking/confirmation?id=${booking.confirmationCode}`,
    },
    actions: [
      {
        action: 'view',
        title: 'Näytä varaus',
        icon: '/icons/icon-72x72.svg',
      },
      {
        action: 'calendar',
        title: 'Lisää kalenteriin',
      },
    ],
  };

  await sendPushNotificationToEmail(customerEmail, payload, {
    bookingId,
    type: 'BOOKING_CONFIRMATION',
  });
}

/**
 * Send payment confirmation notification
 */
export async function sendPaymentConfirmation(
  bookingId: number,
  customerEmail: string,
  amount: number
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const payload: PushNotificationPayload = {
    title: 'Maksu vastaanotettu',
    body: `${(amount / 100).toFixed(2)}€ - ${booking.service.titleFi}`,
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    data: {
      bookingId,
      type: 'payment',
      amount,
      url: `/booking/confirmation?id=${booking.confirmationCode}`,
    },
  };

  await sendPushNotificationToEmail(customerEmail, payload, {
    bookingId,
    type: 'PAYMENT_CONFIRMATION',
  });
}

/**
 * Send promotional notification
 */
export async function sendPromotionalNotification(
  title: string,
  body: string,
  options: {
    image?: string;
    url?: string;
    excludeEmails?: string[];
  } = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  const payload: PushNotificationPayload = {
    title,
    body,
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    image: options.image,
    data: {
      type: 'promotion',
      url: options.url || '/',
    },
    actions: [
      {
        action: 'view',
        title: 'Katso tarjous',
      },
    ],
  };

  return sendPushNotificationToAll(payload, {
    type: 'PROMOTIONAL_OFFER',
    excludeEmails: options.excludeEmails,
  });
}

/**
 * Process scheduled notifications (to be called by cron job)
 */
export async function processScheduledNotifications(): Promise<void> {
  const now = new Date();

  // Get pending notifications that should be sent now
  const pendingNotifications = await prisma.pushNotification.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: {
        lte: now,
      },
      attempts: {
        lt: 3, // Max 3 attempts
      },
    },
    include: {
      subscription: true,
    },
  });

  console.log(`Processing ${pendingNotifications.length} scheduled notifications`);

  for (const notification of pendingNotifications) {
    if (!notification.subscription.isActive) {
      // Skip inactive subscriptions
      await prisma.pushNotification.update({
        where: { id: notification.id },
        data: { status: 'CANCELLED' },
      });
      continue;
    }

    try {
      // Create push subscription object
      const pushSubscription = {
        endpoint: notification.subscription.endpoint,
        keys: {
          p256dh: notification.subscription.p256dh,
          auth: notification.subscription.auth,
        },
      };

      // Create payload
      const payload: PushNotificationPayload = {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || undefined,
        badge: notification.badge || undefined,
        image: notification.image || undefined,
        data: notification.data as any,
        actions: notification.actions as any,
      };

      // Send notification
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          urgency: 'normal',
          TTL: 24 * 60 * 60, // 24 hours
        }
      );

      // Update status
      await prisma.pushNotification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      console.log(`Sent scheduled notification ${notification.id}`);

    } catch (error: any) {
      console.error(`Failed to send scheduled notification ${notification.id}:`, error);

      // If subscription is invalid, mark as inactive
      if (error.statusCode === 410 || error.statusCode === 404) {
        await prisma.pushSubscription.update({
          where: { id: notification.subscription.id },
          data: { isActive: false },
        });
      }

      // Update notification
      await prisma.pushNotification.update({
        where: { id: notification.id },
        data: {
          status: notification.attempts >= 2 ? 'FAILED' : 'PENDING',
          errorMessage: error.message,
          attempts: { increment: 1 },
        },
      });
    }
  }

  // Clean up old expired notifications
  await prisma.pushNotification.updateMany({
    where: {
      status: 'PENDING',
      scheduledFor: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });
}

/**
 * Clean up inactive subscriptions and old notifications
 */
export async function cleanupNotifications(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Delete old notifications
  await prisma.pushNotification.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
      status: {
        in: ['SENT', 'FAILED', 'EXPIRED', 'CANCELLED'],
      },
    },
  });

  // Mark old inactive subscriptions for deletion
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await prisma.pushSubscription.deleteMany({
    where: {
      isActive: false,
      lastUsed: {
        lt: ninetyDaysAgo,
      },
    },
  });

  console.log('Notification cleanup completed');
}

const pushServer = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendPushNotificationToEmail,
  sendPushNotificationToAll,
  scheduleBookingReminder,
  sendBookingConfirmation,
  sendPaymentConfirmation,
  sendPromotionalNotification,
  processScheduledNotifications,
  cleanupNotifications,
};

export default pushServer;