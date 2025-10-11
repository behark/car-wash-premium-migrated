import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createCheckoutSession } from '../../../lib/stripe';
import { z } from 'zod';

const createSessionSchema = z.object({
  bookingId: z.number(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId } = createSessionSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'Booking already paid' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const session = await createCheckoutSession({
      booking,
      successUrl: `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&booking=${booking.confirmationCode}`,
      cancelUrl: `${baseUrl}/booking?cancelled=true`,
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        stripeSessionId: session.id,
      },
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Create payment session error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to create payment session',
      message: error.message,
    });
  }
}