import type { NextApiRequest, NextApiResponse } from 'next';
import { createBooking } from '../../../lib/booking';
import { bookingConfirmationTemplate } from '../../../lib/email-templates';
import sgMail from '@sendgrid/mail';
import { z } from 'zod';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const bookingSchema = z.object({
  serviceId: z.number(),
  vehicleType: z.string(),
  date: z.string().transform(str => new Date(str)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8),
  licensePlate: z.string().optional(),
  notes: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validatedData = bookingSchema.parse(req.body);

    const booking = await createBooking(validatedData);

    if (process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL) {
      const emailTemplate = bookingConfirmationTemplate(booking);

      try {
        await sgMail.send({
          to: booking.customerEmail,
          from: process.env.SENDER_EMAIL,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        service: booking.service,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        customerName: booking.customerName,
        status: booking.status,
      },
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.errors,
      });
    }

    if (error.message === 'Service not found') {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (error.message === 'Time slot is not available') {
      return res.status(409).json({ error: 'Time slot is not available' });
    }

    res.status(500).json({
      error: 'Failed to create booking',
      message: error.message,
    });
  }
}