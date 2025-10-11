import type { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import { prisma } from '../../../lib/prisma';
import { constructWebhookEvent } from '../../../lib/stripe';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { paymentConfirmationTemplate } from '../../../lib/email-templates';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = await constructWebhookEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const bookingId = session.client_reference_id;

        if (!bookingId) {
          console.error('No booking ID in session');
          return res.status(400).json({ error: 'No booking ID' });
        }

        const booking = await prisma.booking.findUnique({
          where: { id: parseInt(bookingId) },
          include: { service: true },
        });

        if (!booking) {
          console.error('Booking not found:', bookingId);
          return res.status(404).json({ error: 'Booking not found' });
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paymentIntentId: session.payment_intent,
            status: BookingStatus.CONFIRMED,
          },
        });

        if (process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL) {
          const emailTemplate = paymentConfirmationTemplate(booking);

          try {
            await sgMail.send({
              to: booking.customerEmail,
              from: process.env.SENDER_EMAIL,
              subject: emailTemplate.subject,
              text: emailTemplate.text,
              html: emailTemplate.html,
            });
          } catch (emailError) {
            console.error('Failed to send payment confirmation email:', emailError);
          }
        }

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as any;
        const bookingId = session.client_reference_id;

        if (bookingId) {
          await prisma.booking.update({
            where: { id: parseInt(bookingId) },
            data: {
              paymentStatus: PaymentStatus.FAILED,
            },
          });
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        const booking = await prisma.booking.findFirst({
          where: { paymentIntentId: paymentIntent.id },
        });

        if (booking) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: PaymentStatus.FAILED,
            },
          });
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
}