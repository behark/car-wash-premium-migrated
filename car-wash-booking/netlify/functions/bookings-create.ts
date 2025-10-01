import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient, BookingStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { format, addMinutes } from 'date-fns';
import sgMail from '@sendgrid/mail';

const prisma = new PrismaClient();

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

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function bookingConfirmationTemplate(booking: any) {
  const formattedDate = format(booking.date, 'dd.MM.yyyy');

  return {
    subject: `Varausvahvistus - ${booking.confirmationCode}`,
    text: `
Hei ${booking.customerName},

Kiitos varauksestasi! Tässä varauksen tiedot:

Palvelu: ${booking.service.titleFi}
Päivämäärä: ${formattedDate}
Kellonaika: ${booking.startTime}
Vahvistuskoodi: ${booking.confirmationCode}

Hinta: ${(booking.priceCents / 100).toFixed(2)}€

Ystävällisin terveisin,
Kiilto & Loisto
    `,
    html: `
<h2>Varausvahvistus</h2>
<p>Hei ${booking.customerName},</p>
<p>Kiitos varauksestasi!</p>
<h3>Varauksen tiedot:</h3>
<ul>
  <li><strong>Palvelu:</strong> ${booking.service.titleFi}</li>
  <li><strong>Päivämäärä:</strong> ${formattedDate}</li>
  <li><strong>Kellonaika:</strong> ${booking.startTime}</li>
  <li><strong>Vahvistuskoodi:</strong> ${booking.confirmationCode}</li>
</ul>
<p><strong>Hinta:</strong> ${(booking.priceCents / 100).toFixed(2)}€</p>
<p>Ystävällisin terveisin,<br>Kiilto & Loisto</p>
    `,
  };
}

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
    const validatedData = bookingSchema.parse(JSON.parse(event.body || '{}'));

    const service = await prisma.service.findUnique({
      where: { id: validatedData.serviceId },
    });

    if (!service) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    const startDateTime = new Date(validatedData.date);
    const [hours, minutes] = validatedData.startTime.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = addMinutes(startDateTime, service.durationMinutes);

    // Check for overlapping bookings
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        date: validatedData.date,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
        OR: [
          {
            AND: [
              { startTime: { lte: format(startDateTime, 'HH:mm') } },
              { endTime: { gt: format(startDateTime, 'HH:mm') } },
            ],
          },
          {
            AND: [
              { startTime: { lt: format(endDateTime, 'HH:mm') } },
              { endTime: { gte: format(endDateTime, 'HH:mm') } },
            ],
          },
        ],
      },
    });

    if (overlappingBooking) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Time slot is not available' }),
      };
    }

    const confirmationCode = generateConfirmationCode();

    const booking = await prisma.booking.create({
      data: {
        serviceId: validatedData.serviceId,
        vehicleType: validatedData.vehicleType,
        date: validatedData.date,
        startTime: format(startDateTime, 'HH:mm'),
        endTime: format(endDateTime, 'HH:mm'),
        duration: service.durationMinutes,
        priceCents: service.priceCents,
        status: BookingStatus.PENDING,
        customerName: validatedData.customerName,
        customerEmail: validatedData.customerEmail,
        customerPhone: validatedData.customerPhone,
        licencePlate: validatedData.licensePlate,
        notes: validatedData.notes,
        paymentStatus: PaymentStatus.PENDING,
        confirmationCode,
      },
      include: {
        service: true,
      },
    });

    // Send confirmation email
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

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
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
      }),
    };
  } catch (error: any) {
    console.error('Booking creation error:', error);

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
        error: 'Failed to create booking',
        message: error.message,
      }),
    };
  }
};

export { handler };
