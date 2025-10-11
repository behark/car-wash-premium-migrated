import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus } from '@prisma/client';
import { z } from 'zod';
import { format, addMinutes } from 'date-fns';
import { sendWhatsApp, generateBookingConfirmationWhatsApp } from '../../../lib/whatsapp';
import { sendSMS } from '../../../lib/sms';

const modifyBookingSchema = z.object({
  confirmationCode: z.string().min(8).max(8),
  action: z.enum(['reschedule', 'cancel', 'view']),
  newDate: z.string().optional(),
  newStartTime: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validatedData = modifyBookingSchema.parse(req.body);

    // Find booking by confirmation code
    const booking = await prisma.booking.findUnique({
      where: { confirmationCode: validatedData.confirmationCode },
      include: {
        service: true,
        customer: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        error: 'Varausta ei löytynyt',
        message: 'Tarkista vahvistuskoodi ja yritä uudelleen'
      });
    }

    // Check if booking can be modified (not too close to appointment time)
    const bookingDateTime = new Date(booking.date);
    const [hours, minutes] = booking.startTime.split(':').map(Number);
    bookingDateTime.setHours(hours, minutes);

    const now = new Date();
    const timeDifference = bookingDateTime.getTime() - now.getTime();
    const hoursUntilBooking = timeDifference / (1000 * 60 * 60);

    // Can't modify booking less than 2 hours before appointment
    if (hoursUntilBooking < 2 && validatedData.action !== 'view') {
      return res.status(400).json({
        error: 'Varaus on liian lähellä',
        message: 'Varausta ei voi muuttaa alle 2 tuntia ennen aikaa. Ota yhteyttä puhelimitse: 044 960 8148'
      });
    }

    // Handle different actions
    switch (validatedData.action) {
      case 'view':
        return res.status(200).json({
          success: true,
          data: {
            booking: {
              id: booking.id,
              confirmationCode: booking.confirmationCode,
              service: {
                titleFi: booking.service.titleFi,
                priceCents: booking.priceCents,
                durationMinutes: booking.service.durationMinutes,
              },
              date: booking.date.toISOString(),
              startTime: booking.startTime,
              endTime: booking.endTime,
              vehicleType: booking.vehicleType,
              licensePlate: booking.licensePlate,
              customerName: booking.customerName,
              customerEmail: booking.customerEmail,
              customerPhone: booking.customerPhone,
              status: booking.status,
              canModify: hoursUntilBooking >= 2,
              hoursUntilBooking: Math.round(hoursUntilBooking * 10) / 10,
              notes: booking.notes,
            },
            customer: booking.customer ? {
              loyaltyTier: booking.customer.loyaltyTier,
              loyaltyPoints: booking.customer.loyaltyPoints,
              totalSpent: booking.customer.totalSpent,
              visitCount: booking.customer.visitCount,
            } : null,
          },
        });

      case 'cancel':
        if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status as BookingStatus)) {
          return res.status(400).json({
            error: 'Varausta ei voi perua',
            message: `Varaus on jo tilassa: ${booking.status}`
          });
        }

        const cancelledBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: validatedData.cancellationReason || 'Asiakas peruutti',
            cancelledAt: new Date(),
          },
          include: { service: true },
        });

        // Send cancellation notification
        if (booking.customerPhone) {
          const message = `🚗 Varaus peruutettu

Hei ${booking.customerName}!

Varauksesi ${booking.confirmationCode} on peruutettu onnistuneesti.

Palvelu: ${booking.service.titleFi}
Aika: ${format(new Date(booking.date), 'dd.MM.yyyy')} ${booking.startTime}

Voit varata uuden ajan: kiiltoloisto-fi.onrender.com/booking

📞 044 960 8148`;

          sendWhatsApp(booking.customerPhone, message).catch(console.error);
          sendSMS(booking.customerPhone, message.replace(/\*/g, '')).catch(console.error);
        }

        return res.status(200).json({
          success: true,
          message: 'Varaus peruutettu onnistuneesti',
          data: { booking: cancelledBooking },
        });

      case 'reschedule':
        if (!validatedData.newDate || !validatedData.newStartTime) {
          return res.status(400).json({
            error: 'Uusi päivä ja aika vaaditaan',
          });
        }

        if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status as BookingStatus)) {
          return res.status(400).json({
            error: 'Varausta ei voi siirtää',
            message: `Varaus on jo tilassa: ${booking.status}`
          });
        }

        // Check new time availability
        const newDateTime = new Date(validatedData.newDate);
        const [newHours, newMinutes] = validatedData.newStartTime.split(':').map(Number);
        newDateTime.setHours(newHours, newMinutes, 0, 0);
        const newEndDateTime = addMinutes(newDateTime, booking.service.durationMinutes);

        // Check for conflicts
        const conflictingBooking = await prisma.booking.findFirst({
          where: {
            date: newDateTime,
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
            },
            id: { not: booking.id }, // Exclude current booking
            OR: [
              {
                AND: [
                  { startTime: { lte: format(newDateTime, 'HH:mm') } },
                  { endTime: { gt: format(newDateTime, 'HH:mm') } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: format(newEndDateTime, 'HH:mm') } },
                  { endTime: { gte: format(newEndDateTime, 'HH:mm') } },
                ],
              },
            ],
          },
        });

        if (conflictingBooking) {
          return res.status(409).json({
            error: 'Aika on varattu',
            message: 'Valitsemasi aika on jo varattu. Valitse toinen aika.'
          });
        }

        // Update booking
        const rescheduledBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            date: newDateTime,
            startTime: format(newDateTime, 'HH:mm'),
            endTime: format(newEndDateTime, 'HH:mm'),
            status: BookingStatus.PENDING, // Reset to pending after reschedule
          },
          include: { service: true },
        });

        // Send reschedule notification
        if (booking.customerPhone) {
          const message = generateBookingConfirmationWhatsApp(
            booking.customerName,
            booking.confirmationCode || '',
            booking.service.titleFi,
            format(newDateTime, 'dd.MM.yyyy'),
            format(newDateTime, 'HH:mm'),
            `${(booking.priceCents / 100).toFixed(0)}€`
          );

          sendWhatsApp(booking.customerPhone, `🔄 Varaus siirretty!\n\n` + message).catch(console.error);
        }

        return res.status(200).json({
          success: true,
          message: 'Varaus siirretty onnistuneesti',
          data: { booking: rescheduledBooking },
        });

      default:
        return res.status(400).json({
          error: 'Invalid action'
        });
    }

  } catch (error: any) {
    console.error('Booking modification error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to modify booking',
      message: error.message,
    });
  }
}