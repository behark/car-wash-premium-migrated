/**
 * Booking Retrieval Endpoint
 * GET /api/bookings-id?id={bookingId|confirmationCode}
 *
 * Retrieves a single booking by ID or confirmation code
 */

import { format } from 'date-fns';
import { z } from 'zod';
import { withPrisma, withRetry } from './lib/prisma';
import { createGetHandler } from './lib/request-handler';
import { CommonErrors } from './lib/error-handler';

/**
 * Query parameter schema for booking retrieval
 */
const BookingIdQuerySchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
});

/**
 * Main handler for booking retrieval
 */
export const handler = createGetHandler<z.infer<typeof BookingIdQuerySchema>>(
  {
    validation: {
      query: BookingIdQuerySchema,
    },
  },
  async ({ query }) => {
    const bookingId = query!.id;

    // Fetch booking using proper connection management
    const booking = await withRetry(async () =>
      withPrisma(async (prisma) => {
        // Try to parse as integer for numeric ID, otherwise treat as confirmation code
        const numericId = parseInt(bookingId, 10);
        const isNumericId = !isNaN(numericId) && numericId.toString() === bookingId;

        return await prisma.booking.findFirst({
          where: {
            OR: [
              { confirmationCode: bookingId },
              isNumericId ? { id: numericId } : {},
            ].filter(condition => Object.keys(condition).length > 0),
          },
          include: {
            service: true,
          },
        });
      })
    );

    if (!booking) {
      throw CommonErrors.notFound('Booking');
    }

    // Format response with consistent structure
    return {
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      service: {
        id: booking.service.id,
        titleFi: booking.service.titleFi,
        titleEn: booking.service.titleEn,
        descriptionFi: booking.service.descriptionFi,
        descriptionEn: booking.service.descriptionEn,
        durationMinutes: booking.service.durationMinutes,
        priceCents: booking.service.priceCents,
      },
      vehicleType: booking.vehicleType,
      date: format(booking.date, 'yyyy-MM-dd'),
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: booking.duration,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      licensePlate: booking.licensePlate,
      notes: booking.notes,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      price: (booking.priceCents / 100).toFixed(2),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
);