/**
 * Stripe Webhook Handler Endpoint
 * POST /api/payment-webhook
 *
 * Handles Stripe webhook events for payment processing
 */

import { Handler, HandlerEvent } from '@netlify/functions';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';
import { withPrisma, withRetry } from './lib/prisma';
import { getCorsHeaders } from './lib/cors';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from './lib/api-response';
import { HttpStatus } from './lib/error-handler';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

// Configure SendGrid if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Creates email template for payment confirmation
 * @param booking - The booking details
 * @returns Email subject and content
 */
function paymentConfirmationTemplate(booking: any) {
  const formattedDate = format(booking.date, 'dd.MM.yyyy');

  return {
    subject: `Maksuvahvistus - ${booking.confirmationCode}`,
    text: `
Hei ${booking.customerName},

Maksusi on vastaanotettu!

Varauksen tiedot:
Palvelu: ${booking.service.titleFi}
Päivämäärä: ${formattedDate}
Kellonaika: ${booking.startTime} - ${booking.endTime}
Vahvistuskoodi: ${booking.confirmationCode}

Maksettu: ${(booking.priceCents / 100).toFixed(2)}€

Nähdään pian!
Kiilto & Loisto
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .details { background-color: #ffffff; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; }
    .confirmation-code { font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Maksuvahvistus</h2>
      <p>Hei ${booking.customerName},</p>
      <p>Maksusi on vastaanotettu!</p>
    </div>

    <div class="details">
      <h3>Varauksen tiedot:</h3>
      <ul>
        <li><strong>Palvelu:</strong> ${booking.service.titleFi}</li>
        <li><strong>Päivämäärä:</strong> ${formattedDate}</li>
        <li><strong>Kellonaika:</strong> ${booking.startTime} - ${booking.endTime}</li>
        <li><strong>Vahvistuskoodi:</strong> <span class="confirmation-code">${booking.confirmationCode}</span></li>
      </ul>
      <p><strong>Maksettu:</strong> ${(booking.priceCents / 100).toFixed(2)}€</p>
    </div>

    <div class="footer">
      <p>Nähdään pian!<br>Kiilto & Loisto</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Sends payment confirmation email to customer
 * @param booking - The booking details
 */
async function sendPaymentConfirmationEmail(booking: any): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDER_EMAIL) {
    console.log('Email sending not configured, skipping payment confirmation email');
    return;
  }

  const emailTemplate = paymentConfirmationTemplate(booking);

  try {
    await sgMail.send({
      to: booking.customerEmail,
      from: process.env.SENDER_EMAIL,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
    console.log(`Payment confirmation email sent to ${booking.customerEmail}`);
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
}

/**
 * Handles checkout.session.completed event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<any> {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    throw new Error('No bookingId found in session metadata');
  }

  const updatedBooking = await withRetry(async () =>
    withPrisma(async (prisma) => {
      return await prisma.$transaction(async (tx: any) => {
        // Update the booking status
        const booking = await tx.booking.update({
          where: { id: parseInt(bookingId, 10) },
          data: {
            status: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            // Store payment intent ID in notes or update schema to include it
            notes: `Payment completed. Intent: ${session.payment_intent}`,
            updatedAt: new Date(),
          },
          include: {
            service: true,
          },
        });

        return booking;
      });
    })
  );

  // Send payment confirmation email (non-blocking)
  sendPaymentConfirmationEmail(updatedBooking).catch(console.error);

  return {
    bookingId: updatedBooking.id,
    confirmationCode: updatedBooking.confirmationCode,
    status: updatedBooking.status,
    paymentStatus: updatedBooking.paymentStatus,
  };
}

/**
 * Handles checkout.session.expired event
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.bookingId;

  if (bookingId) {
    await withRetry(async () =>
      withPrisma(async (prisma) => {
        await prisma.booking.update({
          where: { id: parseInt(bookingId, 10) },
          data: {
            status: BookingStatus.CANCELLED,
            paymentStatus: PaymentStatus.FAILED,
            notes: 'Payment session expired',
            updatedAt: new Date(),
          },
        });
      })
    );
  }
}

/**
 * Handles payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Log payment failures for monitoring
  console.error('Payment failed:', {
    paymentIntentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message,
  });

  // Find booking by searching in notes or by confirmation code
  // Since we don't have stripePaymentId field, we need to find another way
  // In production, you should add stripePaymentId to the schema
  const booking = await withPrisma(async (prisma) => {
    return await prisma.booking.findFirst({
      where: {
        notes: {
          contains: `Intent: ${paymentIntent.id}`,
        },
      },
    });
  });

  if (booking) {
    await withRetry(async () =>
      withPrisma(async (prisma) => {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            notes: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
            updatedAt: new Date(),
          },
        });
      })
    );
  }
}

/**
 * Main webhook handler
 */
export const handler: Handler = async (event: HandlerEvent) => {
  const headers = getCorsHeaders();

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: HttpStatus.NO_CONTENT,
      headers,
      body: '',
    };
  }

  // Validate method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      headers,
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.METHOD_NOT_ALLOWED,
          'Only POST method is allowed'
        )
      ),
    };
  }

  // Validate signature header
  const sig = event.headers['stripe-signature'];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      headers,
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.INVALID_INPUT,
          'Missing signature or webhook secret'
        )
      ),
    };
  }

  let stripeEvent: Stripe.Event;

  // Verify webhook signature
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err);
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      headers,
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.INVALID_INPUT,
          `Webhook signature verification failed: ${err.message}`
        )
      ),
    };
  }

  try {
    let result: any = { received: true };

    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        const completedSession = stripeEvent.data.object as Stripe.Checkout.Session;
        const bookingUpdate = await handleCheckoutCompleted(completedSession);
        result = { ...result, ...bookingUpdate };
        console.log('Payment completed for booking:', bookingUpdate.bookingId);
        break;

      case 'checkout.session.expired':
        const expiredSession = stripeEvent.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(expiredSession);
        result.message = 'Checkout session expired handled';
        console.log('Checkout session expired:', expiredSession.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(failedPaymentIntent);
        result.message = 'Payment failure handled';
        break;

      case 'payment_intent.succeeded':
        // Log successful payments for monitoring
        const successfulPaymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', successfulPaymentIntent.id);
        result.message = 'Payment success logged';
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
        result.message = `Event type ${stripeEvent.type} not handled`;
    }

    return {
      statusCode: HttpStatus.OK,
      headers,
      body: JSON.stringify(createSuccessResponse(result)),
    };
  } catch (error: any) {
    console.error('Error processing webhook:', error);

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      headers,
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to process webhook',
          process.env.NODE_ENV === 'development' ? error.message : undefined
        )
      ),
    };
  }
};