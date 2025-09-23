/**
 * Push Notification Unsubscribe API
 * Handles unsubscription requests from clients
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const validation = unsubscribeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (validation.error as any).errors,
      });
    }

    const { endpoint } = validation.data;

    // Find and deactivate subscription
    const subscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found',
      });
    }

    // Mark subscription as inactive instead of deleting
    // This preserves notification history and prevents duplicate subscriptions
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: {
        isActive: false,
        lastUsed: new Date(),
      },
    });

    // Cancel any pending notifications for this subscription
    await prisma.pushNotification.updateMany({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    console.log(`Push subscription unsubscribed: ${subscription.id}`);

    return res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from push notifications',
    });

  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to unsubscribe from push notifications',
    });
  }
}