/**
 * Payment Session Creation Endpoint
 * POST /api/payment-create-session
 *
 * Creates a Stripe checkout session for booking payment
 */

import Stripe from 'stripe';
import { format } from 'date-fns';
import { PaymentStatus } from '@prisma/client';
import { withPrisma, withRetry } from './lib/prisma';
import { createPostHandler } from './lib/request-handler';
import { PaymentSessionSchema, PaymentSessionInput } from './lib/validation';
import { CommonErrors, ApiError, HttpStatus } from './lib/error-handler';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

/**
 * Validates Stripe configuration
 * @throws ApiError if Stripe is not properly configured
 */
function validateStripeConfig(): void {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ApiError(
      'STRIPE_NOT_CONFIGURED',
      'Payment processing is not configured',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  if (!process.env.FRONTEND_URL) {
    throw new ApiError(
      'FRONTEND_URL_NOT_CONFIGURED',
      'Frontend URL is not configured',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Main handler for payment session creation
 */
export const handler = createPostHandler<PaymentSessionInput>(
  {
    validation: {
      body: PaymentSessionSchema,
    },
  },
  async ({ body }) => {
    const { bookingId, successUrl, cancelUrl } = body!;

    // Validate Stripe configuration
    validateStripeConfig();

    // Fetch booking and create session using proper connection management
    const result = await withRetry(async () =>
      withPrisma(async (prisma) => {
        // Fetch booking with service details
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { service: true },
        });

        if (!booking) {
          throw CommonErrors.notFound('Booking');
        }

        // Validate booking status
        if (booking.paymentStatus === PaymentStatus.PAID) {
          throw new ApiError(
            'ALREADY_PAID',
            'This booking has already been paid',
            HttpStatus.BAD_REQUEST
          );
        }

        if (booking.paymentStatus === PaymentStatus.REFUNDED) {
          throw new ApiError(
            'BOOKING_REFUNDED',
            'This booking has been refunded',
            HttpStatus.BAD_REQUEST
          );
        }

        if (booking.status === 'CANCELLED') {
          throw new ApiError(
            'BOOKING_CANCELLED',
            'This booking has been cancelled',
            HttpStatus.BAD_REQUEST
          );
        }

        // Format date for display
        const formattedDate = format(booking.date, 'dd.MM.yyyy');

        try {
          // Create Stripe checkout session
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'eur',
                  product_data: {
                    name: booking.service.titleFi,
                    description: `Varaus ${formattedDate} klo ${booking.startTime} - ${booking.endTime}`,
                    metadata: {
                      serviceId: booking.service.id.toString(),
                      bookingId: booking.id.toString(),
                    },
                  },
                  unit_amount: booking.priceCents,
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: successUrl || `${process.env.FRONTEND_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
            cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/booking/cancel?booking_id=${booking.id}`,
            metadata: {
              bookingId: booking.id.toString(),
              confirmationCode: booking.confirmationCode,
            },
            customer_email: booking.customerEmail,
            locale: 'fi',
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expire after 30 minutes
            payment_intent_data: {
              description: `Car wash booking #${booking.confirmationCode}`,
              metadata: {
                bookingId: booking.id.toString(),
                confirmationCode: booking.confirmationCode,
              },
            },
          });

          // Update booking with session ID
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              stripeSessionId: session.id,
              updatedAt: new Date(),
            },
          });

          return {
            sessionId: session.id,
            checkoutUrl: session.url,
            expiresAt: new Date(session.expires_at * 1000).toISOString(),
            booking: {
              id: booking.id,
              confirmationCode: booking.confirmationCode,
              amount: (booking.priceCents / 100).toFixed(2),
              currency: 'EUR',
              service: booking.service.titleFi,
              date: formattedDate,
              time: `${booking.startTime} - ${booking.endTime}`,
            },
          };
        } catch (stripeError: any) {
          console.error('Stripe error:', stripeError);

          // Handle specific Stripe errors
          if (stripeError.type === 'StripeCardError') {
            throw new ApiError(
              'PAYMENT_CARD_ERROR',
              stripeError.message,
              HttpStatus.BAD_REQUEST
            );
          }

          if (stripeError.type === 'StripeRateLimitError') {
            throw new ApiError(
              'RATE_LIMIT_ERROR',
              'Too many requests, please try again later',
              HttpStatus.TOO_MANY_REQUESTS
            );
          }

          if (stripeError.type === 'StripeInvalidRequestError') {
            throw new ApiError(
              'INVALID_PAYMENT_REQUEST',
              'Invalid payment request',
              HttpStatus.BAD_REQUEST
            );
          }

          // Generic Stripe error
          throw new ApiError(
            'PAYMENT_PROCESSING_ERROR',
            'Failed to process payment',
            HttpStatus.INTERNAL_SERVER_ERROR,
            process.env.NODE_ENV === 'development' ? stripeError.message : undefined
          );
        }
      })
    );

    return result;
  }
);