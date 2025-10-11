/**
 * Booking Creation Endpoint
 * POST /api/bookings-create
 *
 * Creates a new booking for a car wash service
 */

import { BookingStatus, PaymentStatus } from '@prisma/client';
import { format, addMinutes } from 'date-fns';
import sgMail from '@sendgrid/mail';
import { withPrisma, withRetry } from './lib/prisma';
import { createPostHandler } from './lib/request-handler';
import { BookingCreateSchema, BookingCreateInput } from './lib/validation';
import { CommonErrors, ApiError, HttpStatus } from './lib/error-handler';

// Configure SendGrid if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Generates a unique confirmation code
 * @returns 8-character alphanumeric code
 */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates email template for booking confirmation
 * @param booking - The booking details
 * @returns Email subject and content
 */
function bookingConfirmationTemplate(booking: any) {
  const formattedDate = format(booking.date, 'dd.MM.yyyy');

  return {
    subject: `Varausvahvistus - ${booking.confirmationCode}`,
    text: `
Hei ${booking.customerName},

Kiitos varauksestasi! Tässä varauksen tiedot:

Palvelu: ${booking.service.titleFi}
Päivämäärä: ${formattedDate}
Kellonaika: ${booking.startTime} - ${booking.endTime}
Vahvistuskoodi: ${booking.confirmationCode}

Hinta: ${(booking.priceCents / 100).toFixed(2)}€

Ystävällisin terveisin,
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
    .confirmation-code { font-size: 24px; font-weight: bold; color: #007bff; margin: 10px 0; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Varausvahvistus</h2>
      <p>Hei ${booking.customerName},</p>
      <p>Kiitos varauksestasi!</p>
    </div>

    <div class="details">
      <h3>Varauksen tiedot:</h3>
      <ul>
        <li><strong>Palvelu:</strong> ${booking.service.titleFi}</li>
        <li><strong>Päivämäärä:</strong> ${formattedDate}</li>
        <li><strong>Kellonaika:</strong> ${booking.startTime} - ${booking.endTime}</li>
        <li><strong>Vahvistuskoodi:</strong> <span class="confirmation-code">${booking.confirmationCode}</span></li>
      </ul>
      <p><strong>Hinta:</strong> ${(booking.priceCents / 100).toFixed(2)}€</p>
    </div>

    <div class="footer">
      <p>Ystävällisin terveisin,<br>Kiilto & Loisto</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Sends confirmation email to customer
 * @param booking - The booking details
 */
async function sendConfirmationEmail(booking: any): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDER_EMAIL) {
    console.log('Email sending not configured, skipping confirmation email');
    return;
  }

  const emailTemplate = bookingConfirmationTemplate(booking);

  try {
    await sgMail.send({
      to: booking.customerEmail,
      from: process.env.SENDER_EMAIL,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
    console.log(`Confirmation email sent to ${booking.customerEmail}`);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    // Don't throw - email failure shouldn't fail the booking
  }
}

/**
 * Main handler for booking creation
 */
export const handler = createPostHandler<BookingCreateInput>(
  {
    validation: {
      body: BookingCreateSchema,
    },
  },
  async ({ body }) => {
    const validatedData = body!;

    // Create booking using proper connection management
    const booking = await withRetry(async () =>
      withPrisma(async (prisma) => {
        // Fetch service details
        const service = await prisma.service.findUnique({
          where: { id: validatedData.serviceId },
        });

        if (!service) {
          throw CommonErrors.notFound('Service');
        }

        if (!service.isActive) {
          throw new ApiError(
            'SERVICE_INACTIVE',
            'This service is currently not available',
            HttpStatus.BAD_REQUEST
          );
        }

        // Calculate start and end times
        const startDateTime = new Date(validatedData.date);
        const [hours, minutes] = validatedData.startTime.split(':').map(Number);
        startDateTime.setHours(hours, minutes, 0, 0);

        const endDateTime = addMinutes(startDateTime, service.durationMinutes);

        // Create booking in a transaction to ensure consistency
        return await prisma.$transaction(async (tx: any) => {
          // Check for overlapping bookings
          const overlappingBooking = await tx.booking.findFirst({
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
                {
                  AND: [
                    { startTime: { gte: format(startDateTime, 'HH:mm') } },
                    { endTime: { lte: format(endDateTime, 'HH:mm') } },
                  ],
                },
              ],
            },
          });

          if (overlappingBooking) {
            throw new ApiError(
              'TIME_SLOT_UNAVAILABLE',
              'The selected time slot is not available',
              HttpStatus.CONFLICT
            );
          }

          // Generate unique confirmation code
          let confirmationCode: string;
          let codeExists = true;
          let attempts = 0;

          while (codeExists && attempts < 10) {
            confirmationCode = generateConfirmationCode();
            const existing = await tx.booking.findUnique({
              where: { confirmationCode },
            });
            codeExists = !!existing;
            attempts++;
          }

          if (attempts >= 10) {
            throw new ApiError(
              'CONFIRMATION_CODE_GENERATION_FAILED',
              'Failed to generate unique confirmation code',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }

          // Create the booking
          const newBooking = await tx.booking.create({
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
              licensePlate: validatedData.licensePlate || null,
              notes: validatedData.notes || null,
              paymentStatus: PaymentStatus.PENDING,
              confirmationCode: confirmationCode!,
            },
            include: {
              service: true,
            },
          });

          return newBooking;
        });
      })
    );

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(booking).catch(console.error);

    // Return formatted response
    return {
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      service: {
        id: booking.service.id,
        titleFi: booking.service.titleFi,
        titleEn: booking.service.titleEn,
        descriptionFi: booking.service.descriptionFi,
        descriptionEn: booking.service.descriptionEn,
      },
      vehicleType: booking.vehicleType,
      date: format(booking.date, 'yyyy-MM-dd'),
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: booking.duration,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      price: (booking.priceCents / 100).toFixed(2),
      createdAt: booking.createdAt.toISOString(),
    };
  }
);