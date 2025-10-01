import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const createSessionSchema = z.object({
  bookingId: z.number(),
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { bookingId } = createSessionSchema.parse(JSON.parse(event.body || '{}'));

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: true },
    });

    if (!booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' }),
      };
    }

    if (booking.paymentStatus === 'PAID') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking already paid' }),
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || event.headers.origin || 'https://kiiltoloisto.fi';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: booking.service.titleFi,
              description: booking.service.descriptionFi,
            },
            unit_amount: booking.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&booking=${booking.confirmationCode}`,
      cancel_url: `${baseUrl}/booking?cancelled=true`,
      metadata: {
        bookingId: booking.id.toString(),
        confirmationCode: booking.confirmationCode,
      },
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        stripeSessionId: session.id,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionId: session.id,
        url: session.url,
      }),
    };
  } catch (error: any) {
    console.error('Create payment session error:', error);

    if (error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid input data',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment session',
        message: error.message,
      }),
    };
  }
};

export { handler };
