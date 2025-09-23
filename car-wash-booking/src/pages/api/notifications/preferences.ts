/**
 * Notification Preferences API
 * Manages user preferences for different types of notifications
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const preferencesSchema = z.object({
  customerEmail: z.string().email(),
  bookingReminders: z.boolean().optional(),
  paymentConfirmations: z.boolean().optional(),
  promotionalOffers: z.boolean().optional(),
  statusUpdates: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  reminderHoursBefore: z.number().min(1).max(168).optional(), // 1 hour to 1 week
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetPreferences(req, res);
  } else if (req.method === 'POST') {
    return handleUpdatePreferences(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Get notification preferences for a customer
 */
async function handleGetPreferences(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email parameter is required',
      });
    }

    // Validate email format
    const emailValidation = z.string().email().safeParse(email);
    if (!emailValidation.success) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // Get preferences from database
    const preferences = await prisma.notificationPreference.findUnique({
      where: { customerEmail: email },
    });

    if (!preferences) {
      // Return default preferences if not found
      return res.status(200).json({
        customerEmail: email,
        bookingReminders: true,
        paymentConfirmations: true,
        promotionalOffers: false,
        statusUpdates: true,
        marketingEmails: false,
        smsNotifications: false,
        pushNotifications: true,
        reminderHoursBefore: 24,
      });
    }

    return res.status(200).json({
      customerEmail: preferences.customerEmail,
      bookingReminders: preferences.bookingReminders,
      paymentConfirmations: preferences.paymentConfirmations,
      promotionalOffers: preferences.promotionalOffers,
      statusUpdates: preferences.statusUpdates,
      marketingEmails: preferences.marketingEmails,
      smsNotifications: preferences.smsNotifications,
      pushNotifications: preferences.pushNotifications,
      reminderHoursBefore: preferences.reminderHoursBefore,
    });

  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get notification preferences',
    });
  }
}

/**
 * Update notification preferences for a customer
 */
async function handleUpdatePreferences(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Validate request body
    const validation = preferencesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (validation.error as any).errors,
      });
    }

    const {
      customerEmail,
      bookingReminders,
      paymentConfirmations,
      promotionalOffers,
      statusUpdates,
      marketingEmails,
      smsNotifications,
      pushNotifications,
      reminderHoursBefore,
    } = validation.data;

    // Update or create preferences
    const preferences = await prisma.notificationPreference.upsert({
      where: { customerEmail },
      create: {
        customerEmail,
        bookingReminders: bookingReminders ?? true,
        paymentConfirmations: paymentConfirmations ?? true,
        promotionalOffers: promotionalOffers ?? false,
        statusUpdates: statusUpdates ?? true,
        marketingEmails: marketingEmails ?? false,
        smsNotifications: smsNotifications ?? false,
        pushNotifications: pushNotifications ?? true,
        reminderHoursBefore: reminderHoursBefore ?? 24,
      },
      update: {
        ...(bookingReminders !== undefined && { bookingReminders }),
        ...(paymentConfirmations !== undefined && { paymentConfirmations }),
        ...(promotionalOffers !== undefined && { promotionalOffers }),
        ...(statusUpdates !== undefined && { statusUpdates }),
        ...(marketingEmails !== undefined && { marketingEmails }),
        ...(smsNotifications !== undefined && { smsNotifications }),
        ...(pushNotifications !== undefined && { pushNotifications }),
        ...(reminderHoursBefore !== undefined && { reminderHoursBefore }),
      },
    });

    // If push notifications are disabled, deactivate push subscriptions
    if (pushNotifications === false) {
      await prisma.pushSubscription.updateMany({
        where: { customerEmail },
        data: { isActive: false },
      });

      // Cancel pending notifications
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { customerEmail },
        select: { id: true },
      });

      if (subscriptions.length > 0) {
        await prisma.pushNotification.updateMany({
          where: {
            subscriptionId: { in: subscriptions.map(s => s.id) },
            status: 'PENDING',
          },
          data: { status: 'CANCELLED' },
        });
      }
    }

    console.log(`Updated notification preferences for ${customerEmail}`);

    return res.status(200).json({
      success: true,
      preferences: {
        customerEmail: preferences.customerEmail,
        bookingReminders: preferences.bookingReminders,
        paymentConfirmations: preferences.paymentConfirmations,
        promotionalOffers: preferences.promotionalOffers,
        statusUpdates: preferences.statusUpdates,
        marketingEmails: preferences.marketingEmails,
        smsNotifications: preferences.smsNotifications,
        pushNotifications: preferences.pushNotifications,
        reminderHoursBefore: preferences.reminderHoursBefore,
      },
    });

  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update notification preferences',
    });
  }
}