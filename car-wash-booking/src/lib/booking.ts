import { prisma } from './prisma';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { format, addMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';
import { fi } from 'date-fns/locale';

export interface TimeSlot {
  time: string;
  available: boolean;
  capacity?: number;
}

export interface BookingData {
  serviceId: number;
  vehicleType: string;
  date: Date;
  startTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  licensePlate?: string;
  notes?: string;
}

export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function checkAvailability(date: Date, serviceId: number): Promise<TimeSlot[]> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const existingBookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      },
    },
  });

  const dayOfWeek = date.getDay();
  const businessHours = await prisma.businessHours.findUnique({
    where: { dayOfWeek },
  });

  if (!businessHours || !businessHours.isOpen) {
    return [];
  }

  const holidays = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  if (holidays) {
    return [];
  }

  const timeSlots: TimeSlot[] = [];
  const startHour = parseInt(businessHours.startTime.split(':')[0]);
  const startMinute = parseInt(businessHours.startTime.split(':')[1]);
  const endHour = parseInt(businessHours.endTime.split(':')[0]);
  const endMinute = parseInt(businessHours.endTime.split(':')[1]);

  let currentTime = new Date(date);
  currentTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(endHour, endMinute, 0, 0);

  while (currentTime < endTime) {
    const timeString = format(currentTime, 'HH:mm');
    const slotEndTime = addMinutes(currentTime, service.durationMinutes);

    if (businessHours.breakStart && businessHours.breakEnd) {
      const breakStart = new Date(date);
      const [breakStartHour, breakStartMinute] = businessHours.breakStart.split(':').map(Number);
      breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);

      const breakEnd = new Date(date);
      const [breakEndHour, breakEndMinute] = businessHours.breakEnd.split(':').map(Number);
      breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

      if (
        (currentTime >= breakStart && currentTime < breakEnd) ||
        (slotEndTime > breakStart && slotEndTime <= breakEnd)
      ) {
        currentTime = addMinutes(currentTime, 30);
        continue;
      }
    }

    const isBooked = existingBookings.some(booking => {
      const bookingStart = parseISO(`${format(booking.date, 'yyyy-MM-dd')}T${booking.startTime}`);
      const bookingEnd = addMinutes(bookingStart, booking.duration);

      return (
        (currentTime >= bookingStart && currentTime < bookingEnd) ||
        (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
        (currentTime <= bookingStart && slotEndTime >= bookingEnd)
      );
    });

    if (slotEndTime <= endTime) {
      timeSlots.push({
        time: timeString,
        available: !isBooked,
      });
    }

    currentTime = addMinutes(currentTime, 30);
  }

  return timeSlots;
}

export async function createBooking(data: BookingData) {
  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const startDateTime = new Date(data.date);
  const [hours, minutes] = data.startTime.split(':').map(Number);
  startDateTime.setHours(hours, minutes, 0, 0);

  const endDateTime = addMinutes(startDateTime, service.durationMinutes);

  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      date: data.date,
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
    throw new Error('Time slot is not available');
  }

  const confirmationCode = generateConfirmationCode();

  const booking = await prisma.booking.create({
    data: {
      serviceId: data.serviceId,
      vehicleType: data.vehicleType,
      date: data.date,
      startTime: format(startDateTime, 'HH:mm'),
      endTime: format(endDateTime, 'HH:mm'),
      duration: service.durationMinutes,
      priceCents: service.priceCents,
      status: BookingStatus.PENDING,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      licensePlate: data.licensePlate,
      notes: data.notes,
      paymentStatus: PaymentStatus.PENDING,
      confirmationCode,
    },
    include: {
      service: true,
    },
  });

  return booking;
}

export async function updateBookingStatus(
  bookingId: number,
  status: BookingStatus,
  adminNotes?: string
) {
  const updateData: any = { status };

  if (adminNotes) {
    updateData.adminNotes = adminNotes;
  }

  if (status === BookingStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
  } else if (status === BookingStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
    include: {
      service: true,
    },
  });

  return booking;
}

export async function getBookingByConfirmationCode(code: string) {
  const booking = await prisma.booking.findUnique({
    where: { confirmationCode: code },
    include: {
      service: true,
    },
  });

  return booking;
}

export async function getUpcomingBookings(limit = 10) {
  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: new Date(),
      },
      status: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
      },
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
    take: limit,
    include: {
      service: true,
    },
  });

  return bookings;
}

export async function getTodaysBookings() {
  const today = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      status: {
        notIn: [BookingStatus.CANCELLED],
      },
    },
    orderBy: [
      { startTime: 'asc' },
    ],
    include: {
      service: true,
    },
  });

  return bookings;
}

export async function getDailyStats(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      service: true,
    },
  });

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === BookingStatus.CONFIRMED).length,
    completed: bookings.filter(b => b.status === BookingStatus.COMPLETED).length,
    cancelled: bookings.filter(b => b.status === BookingStatus.CANCELLED).length,
    revenue: bookings
      .filter(b => b.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, b) => sum + b.priceCents, 0) / 100,
  };

  return stats;
}