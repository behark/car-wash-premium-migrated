import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { retrieveSession } from '../../../lib/stripe';
import { z } from 'zod';

const verifySchema = z.object({
  sessionId: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = verifySchema.parse(req.query);

    const session = await retrieveSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const bookingId = session.client_reference_id;

    if (!bookingId) {
      return res.status(400).json({ error: 'No booking associated with this session' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { service: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.status(200).json({
      success: true,
      paymentStatus: session.payment_status,
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        service: booking.service,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        customerName: booking.customerName,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message,
    });
  }
}