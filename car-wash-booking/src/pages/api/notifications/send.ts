/**
 * Send Push Notifications API
 * Admin endpoint for sending push notifications and managing notification campaigns
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { z } from 'zod';
import {
  sendPushNotificationToEmail,
  sendPushNotificationToAll,
  sendPromotionalNotification,
  sendBookingConfirmation,
  sendPaymentConfirmation,
} from '../../../lib/push/server';

const sendNotificationSchema = z.object({
  type: z.enum(['test', 'promotional', 'booking_confirmation', 'payment_confirmation', 'custom']),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(200),
  icon: z.string().url().optional(),
  image: z.string().url().optional(),
  url: z.string().optional(),
  customerEmail: z.string().email().optional(),
  bookingId: z.number().optional(),
  amount: z.number().optional(),
  excludeEmails: z.array(z.string().email()).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication for admin access
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    // Validate request body
    const validation = sendNotificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (validation.error as any).errors,
      });
    }

    const {
      type,
      title,
      body,
      icon,
      image,
      url,
      customerEmail,
      bookingId,
      amount,
      excludeEmails,
      scheduledFor,
    } = validation.data;

    let result;

    switch (type) {
      case 'test':
        if (!customerEmail) {
          return res.status(400).json({
            error: 'Customer email required for test notifications',
          });
        }

        result = await sendPushNotificationToEmail(
          customerEmail,
          {
            title: `[TEST] ${title}`,
            body,
            icon: icon || '/icons/icon-192x192.svg',
            badge: '/icons/icon-72x72.svg',
            image,
            data: {
              type: 'test',
              url: url || '/',
            },
          },
          {
            type: 'CUSTOM',
            scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
          }
        );
        break;

      case 'promotional':
        result = await sendPromotionalNotification(title, body, {
          image,
          url,
          excludeEmails,
        });
        break;

      case 'booking_confirmation':
        if (!bookingId || !customerEmail) {
          return res.status(400).json({
            error: 'Booking ID and customer email required for booking confirmations',
          });
        }

        await sendBookingConfirmation(bookingId, customerEmail);
        result = { success: 1, failed: 0, errors: [] };
        break;

      case 'payment_confirmation':
        if (!bookingId || !customerEmail || !amount) {
          return res.status(400).json({
            error: 'Booking ID, customer email, and amount required for payment confirmations',
          });
        }

        await sendPaymentConfirmation(bookingId, customerEmail, amount);
        result = { success: 1, failed: 0, errors: [] };
        break;

      case 'custom':
        if (customerEmail) {
          // Send to specific customer
          result = await sendPushNotificationToEmail(
            customerEmail,
            {
              title,
              body,
              icon: icon || '/icons/icon-192x192.svg',
              badge: '/icons/icon-72x72.svg',
              image,
              data: {
                type: 'custom',
                url: url || '/',
              },
            },
            {
              type: 'CUSTOM',
              scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            }
          );
        } else {
          // Send to all subscribers
          result = await sendPushNotificationToAll(
            {
              title,
              body,
              icon: icon || '/icons/icon-192x192.svg',
              badge: '/icons/icon-72x72.svg',
              image,
              data: {
                type: 'custom',
                url: url || '/',
              },
            },
            {
              type: 'CUSTOM',
              excludeEmails,
              scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            }
          );
        }
        break;

      default:
        return res.status(400).json({
          error: 'Invalid notification type',
        });
    }

    console.log(`Notification sent by admin ${(session.user as any)?.email}:`, {
      type,
      title,
      success: result.success,
      failed: result.failed,
    });

    return res.status(200).json({
      success: true,
      message: `Notification sent successfully`,
      results: {
        sent: result.success,
        failed: result.failed,
        errors: result.errors,
      },
    });

  } catch (error: any) {
    console.error('Failed to send push notification:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to send push notification',
    });
  }
}