import Stripe from 'stripe';
import { Booking, Service } from '@prisma/client';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15' as any,
});

export interface CreateCheckoutSessionParams {
  booking: Booking & { service: Service };
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession({
  booking,
  successUrl,
  cancelUrl,
}: CreateCheckoutSessionParams) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: booking.service.titleFi,
            description: `${booking.service.descriptionFi} - ${booking.date.toLocaleDateString('fi-FI')} klo ${booking.startTime}`,
            metadata: {
              bookingId: booking.id.toString(),
            },
          },
          unit_amount: booking.priceCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: booking.customerEmail,
    client_reference_id: booking.id.toString(),
    metadata: {
      bookingId: booking.id.toString(),
      confirmationCode: booking.confirmationCode || '',
    },
    locale: 'fi',
  });

  return session;
}

export async function retrieveSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session;
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function createRefund(paymentIntentId: string, amount?: number) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount,
  });
  return refund;
}

export async function getPaymentIntent(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent;
}