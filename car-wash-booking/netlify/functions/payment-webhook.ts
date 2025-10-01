import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient, BookingStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
Kellonaika: ${booking.startTime}
Vahvistuskoodi: ${booking.confirmationCode}

Maksettu: ${(booking.priceCents / 100).toFixed(2)}€

Nähdään pian!
Kiilto & Loisto
    `,
    html: `
<h2>Maksuvahvistus</h2>
<p>Hei ${booking.customerName},</p>
<p>Maksusi on vastaanotettu!</p>
<h3>Varauksen tiedot:</h3>
<ul>
  <li><strong>Palvelu:</strong> ${booking.service.titleFi}</li>
  <li><strong>Päivämäärä:</strong> ${formattedDate}</li>
  <li><strong>Kellonaika:</strong> ${booking.startTime}</li>
  <li><strong>Vahvistuskoodi:</strong> ${booking.confirmationCode}</li>
</ul>
<p><strong>Maksettu:</strong> ${(booking.priceCents / 100).toFixed(2)}€</p>
<p>Nähdään pian!<br>Kiilto & Loisto</p>
    `,
  };
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing signature or webhook secret' }),
    };
  }

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body || '',
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as any;
        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.error('No booking ID in session metadata');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No booking ID' }),
          };
        }

        const booking = await prisma.booking.findUnique({
          where: { id: parseInt(bookingId) },
          include: { service: true },
        });

        if (!booking) {
          console.error('Booking not found:', bookingId);
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Booking not found' }),
          };
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
        const session = stripeEvent.data.object as any;
        const bookingId = session.metadata?.bookingId;

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
        const paymentIntent = stripeEvent.data.object as any;
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
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Webhook processing failed',
        message: error.message,
      }),
    };
  }
};

export { handler };
