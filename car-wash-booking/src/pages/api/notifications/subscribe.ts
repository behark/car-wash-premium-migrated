/**
 * Push Notification Subscription API
 * Handles subscription and unsubscription requests from clients
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
  userAgent: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return handleSubscribe(req, res);
  } else if (req.method === 'PUT') {
    return handleUpdateSubscription(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Subscribe to push notifications
 */
async function handleSubscribe(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Validate request body
    const validation = subscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (validation.error as any).errors,
      });
    }

    const { endpoint, p256dh, auth, userAgent, customerEmail } = validation.data;

    // Check if subscription already exists
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (existingSubscription) {
      // Update existing subscription
      const updatedSubscription = await prisma.pushSubscription.update({
        where: { endpoint },
        data: {
          p256dh,
          auth,
          userAgent,
          customerEmail,
          isActive: true,
          lastUsed: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        subscription: {
          id: updatedSubscription.id,
          endpoint: updatedSubscription.endpoint,
        },
      });
    }

    // Create new subscription
    const subscription = await prisma.pushSubscription.create({
      data: {
        endpoint,
        p256dh,
        auth,
        userAgent,
        customerEmail,
        isActive: true,
      },
    });

    // Log subscription creation
    console.log(`New push subscription created: ${subscription.id} for ${customerEmail || 'anonymous'}`);

    return res.status(201).json({
      success: true,
      subscription: {
        id: subscription.id,
        endpoint: subscription.endpoint,
      },
    });

  } catch (error) {
    console.error('Failed to create push subscription:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create push subscription',
    });
  }
}

/**
 * Update existing push subscription
 */
async function handleUpdateSubscription(req: NextApiRequest, res: NextApiResponse) {
  try {
    const validation = subscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (validation.error as any).errors,
      });
    }

    const { endpoint, p256dh, auth, userAgent, customerEmail } = validation.data;

    // Update subscription
    const updatedSubscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh,
        auth,
        userAgent,
        customerEmail,
        isActive: true,
      },
      update: {
        p256dh,
        auth,
        userAgent,
        customerEmail,
        isActive: true,
        lastUsed: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        endpoint: updatedSubscription.endpoint,
      },
    });

  } catch (error) {
    console.error('Failed to update push subscription:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update push subscription',
    });
  }
}