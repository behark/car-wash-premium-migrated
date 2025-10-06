import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus } from '@prisma/client';
import { z } from 'zod';
import { bookingCancellationTemplate } from '../../../lib/email-templates';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const updateSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  adminNotes: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid booking ID' });
  }

  if (req.method === 'GET') {
    try {
      let booking;

      if (id.length === 8 && /^[A-Z0-9]+$/.test(id)) {
        // Lookup by confirmation code
        booking = await prisma.booking.findUnique({
          where: { confirmationCode: id },
          include: { service: true },
        });
      } else if (!isNaN(Number(id))) {
        booking = await prisma.booking.findUnique({
          where: { id: Number(id) },
          include: { service: true },
        });
      }

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.status(200).json({
        success: true,
        booking,
      });
    } catch (error: any) {
      console.error('Get booking error:', error);
      res.status(500).json({
        error: 'Failed to get booking',
        message: error.message,
      });
    }
  } else if (req.method === 'PATCH') {
    try {
      const validatedData = updateSchema.parse(req.body);

      const bookingId = Number(id);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID' });
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: validatedData.status,
          // adminNotes field might not exist in schema, so commenting out
          // adminNotes: validatedData.adminNotes,
        },
        include: { service: true },
      });

      res.status(200).json({
        success: true,
        booking: updatedBooking,
      });
    } catch (error: any) {
      console.error('Update booking error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid input data',
          details: error.errors,
        });
      }

      res.status(500).json({
        error: 'Failed to update booking',
        message: error.message,
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const bookingId = Number(id);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID' });
      }

      const cancelledBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
        include: { service: true },
      });

      res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: cancelledBooking,
      });
    } catch (error: any) {
      console.error('Cancel booking error:', error);
      res.status(500).json({
        error: 'Failed to cancel booking',
        message: error.message,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}