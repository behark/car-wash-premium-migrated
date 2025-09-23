import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { updateBookingStatus, getBookingByConfirmationCode } from '../../../lib/booking';
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
        booking = await getBookingByConfirmationCode(id);
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

      const existingBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { service: true },
      });

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      let updatedBooking = existingBooking;

      if (validatedData.status) {
        updatedBooking = await updateBookingStatus(
          bookingId,
          validatedData.status,
          validatedData.adminNotes
        );

        if (
          validatedData.status === BookingStatus.CANCELLED &&
          process.env.SENDGRID_API_KEY &&
          process.env.SENDER_EMAIL
        ) {
          const emailTemplate = bookingCancellationTemplate(updatedBooking);

          try {
            await sgMail.send({
              to: updatedBooking.customerEmail,
              from: process.env.SENDER_EMAIL,
              subject: emailTemplate.subject,
              text: emailTemplate.text,
              html: emailTemplate.html,
            });
          } catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
          }
        }
      }

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

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { service: true },
      });

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const cancelledBooking = await updateBookingStatus(
        bookingId,
        BookingStatus.CANCELLED,
        'Cancelled by customer'
      );

      if (process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL) {
        const emailTemplate = bookingCancellationTemplate(cancelledBooking);

        try {
          await sgMail.send({
            to: cancelledBooking.customerEmail,
            from: process.env.SENDER_EMAIL,
            subject: emailTemplate.subject,
            text: emailTemplate.text,
            html: emailTemplate.html,
          });
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError);
        }
      }

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