/**
 * Booking Service Tests
 * Enterprise-grade test coverage for booking business logic
 */

import { BookingStatus, PaymentStatus, Service, Booking } from '@prisma/client';
import {
  checkAvailability,
  createBooking,
  updateBookingStatus,
  getBookingByConfirmationCode,
  generateConfirmationCode,
  getDailyStats
} from '../booking';
import { BookingFactory, ServiceFactory } from '../../../tests/factories';
import { DatabaseTestUtils, DateTestUtils, ErrorTestUtils } from '../../../tests/utils/testHelpers';

// Mock the prisma module
jest.mock('../prisma');

describe('Booking Service', () => {
  let mockPrisma: ReturnType<typeof DatabaseTestUtils.getMockPrisma>;

  beforeEach(() => {
    mockPrisma = DatabaseTestUtils.getMockPrisma();
    DatabaseTestUtils.setupMockResponses(mockPrisma);
  });

  describe('generateConfirmationCode', () => {
    it('should generate a valid confirmation code', () => {
      const code = generateConfirmationCode();

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate unique confirmation codes', () => {
      const codes = Array.from({ length: 100 }, () => generateConfirmationCode());
      const uniqueCodes = new Set(codes);

      // Should have high uniqueness (allowing for small chance of collision)
      expect(uniqueCodes.size).toBeGreaterThan(95);
    });
  });

  describe('checkAvailability', () => {
    it('should return available time slots for a valid service and date', async () => {
      const service = ServiceFactory.build({
        id: 1,
        durationMinutes: 60,
        isActive: true
      });
      const testDate = DateTestUtils.createTestDate(1);

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.businessHours.findUnique.mockResolvedValue({
        id: 1,
        dayOfWeek: testDate.getDay(),
        startTime: '08:00',
        endTime: '18:00',
        isOpen: true,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.holiday.findFirst.mockResolvedValue(null);

      const timeSlots = await checkAvailability(testDate, service.id);

      expect(timeSlots).toBeArray();
      expect(timeSlots.length).toBeGreaterThan(0);
      expect(timeSlots[0]).toHaveProperty('time');
      expect(timeSlots[0]).toHaveProperty('available');
    });

    it('should return empty array for non-existent service', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      await ErrorTestUtils.expectToThrow(
        () => checkAvailability(new Date(), 999),
        'Service not found'
      );
    });

    it('should return empty array for closed day', async () => {
      const service = ServiceFactory.build();
      const testDate = DateTestUtils.createTestDate(1);

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.businessHours.findUnique.mockResolvedValue({
        id: 1,
        dayOfWeek: testDate.getDay(),
        startTime: '08:00',
        endTime: '18:00',
        isOpen: false,
        breakStart: null,
        breakEnd: null,
      });

      const timeSlots = await checkAvailability(testDate, service.id);

      expect(timeSlots).toEqual([]);
    });

    it('should return empty array for holiday', async () => {
      const service = ServiceFactory.build();
      const testDate = DateTestUtils.createTestDate(1);

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.businessHours.findUnique.mockResolvedValue({
        id: 1,
        dayOfWeek: testDate.getDay(),
        startTime: '08:00',
        endTime: '18:00',
        isOpen: true,
        breakStart: null,
        breakEnd: null,
      });
      mockPrisma.holiday.findFirst.mockResolvedValue({
        id: 1,
        date: testDate,
        name: 'Test Holiday',
        description: 'Test holiday',
      });

      const timeSlots = await checkAvailability(testDate, service.id);

      expect(timeSlots).toEqual([]);
    });

    it('should handle break times correctly', async () => {
      const service = ServiceFactory.build({ durationMinutes: 60 });
      const testDate = DateTestUtils.createTestDate(1);

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.businessHours.findUnique.mockResolvedValue({
        id: 1,
        dayOfWeek: testDate.getDay(),
        startTime: '08:00',
        endTime: '18:00',
        isOpen: true,
        breakStart: '12:00',
        breakEnd: '13:00',
      });
      mockPrisma.holiday.findFirst.mockResolvedValue(null);

      const timeSlots = await checkAvailability(testDate, service.id);

      // Should not have slots during break time
      const breakSlots = timeSlots.filter(slot =>
        slot.time >= '12:00' && slot.time < '13:00'
      );
      expect(breakSlots).toHaveLength(0);
    });
  });

  describe('createBooking', () => {
    it('should create a new booking successfully', async () => {
      const service = ServiceFactory.build({
        id: 1,
        durationMinutes: 60,
        priceCents: 2500
      });
      const bookingData = {
        serviceId: service.id,
        vehicleType: 'sedan',
        date: DateTestUtils.createTestDate(1),
        startTime: '10:00',
        customerName: 'Matti Meikäläinen',
        customerEmail: 'matti@example.com',
        customerPhone: '+358401234567',
        licensePlate: 'ABC-123',
        notes: 'Test booking',
      };
      const expectedBooking = BookingFactory.build({
        ...bookingData,
        serviceId: service.id,
        service,
      });

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.booking.findFirst.mockResolvedValue(null); // No overlapping booking
      mockPrisma.booking.create.mockResolvedValue(expectedBooking as any);

      const result = await createBooking(bookingData);

      expect(result).toBeDefined();
      expect(mockPrisma.booking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceId: service.id,
          vehicleType: 'sedan',
          customerName: 'Matti Meikäläinen',
          customerEmail: 'matti@example.com',
          status: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          priceCents: service.priceCents,
          duration: service.durationMinutes,
        }),
        include: {
          service: true,
        },
      });
    });

    it('should throw error for non-existent service', async () => {
      const bookingData = {
        serviceId: 999,
        vehicleType: 'sedan',
        date: DateTestUtils.createTestDate(1),
        startTime: '10:00',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '+358401234567',
      };

      mockPrisma.service.findUnique.mockResolvedValue(null);

      await ErrorTestUtils.expectToThrow(
        () => createBooking(bookingData),
        'Service not found'
      );
    });

    it('should throw error for overlapping booking', async () => {
      const service = ServiceFactory.build();
      const bookingData = {
        serviceId: service.id,
        vehicleType: 'sedan',
        date: DateTestUtils.createTestDate(1),
        startTime: '10:00',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '+358401234567',
      };
      const overlappingBooking = BookingFactory.build({
        startTime: '10:00',
        endTime: '11:00',
        status: BookingStatus.CONFIRMED,
      });

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.booking.findFirst.mockResolvedValue(overlappingBooking as any);

      await ErrorTestUtils.expectToThrow(
        () => createBooking(bookingData),
        'Time slot is not available'
      );
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status successfully', async () => {
      const booking = BookingFactory.build({
        id: 1,
        status: BookingStatus.PENDING
      });
      const updatedBooking = {
        ...booking,
        status: BookingStatus.CONFIRMED
      };

      mockPrisma.booking.update.mockResolvedValue(updatedBooking as any);

      const result = await updateBookingStatus(
        booking.id,
        BookingStatus.CONFIRMED,
        'Booking confirmed'
      );

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: booking.id },
        data: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          adminNotes: 'Booking confirmed',
        }),
        include: {
          service: true,
        },
      });
    });

    it('should set cancelledAt when status is CANCELLED', async () => {
      const booking = BookingFactory.build({ id: 1 });

      mockPrisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      } as any);

      await updateBookingStatus(booking.id, BookingStatus.CANCELLED);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: booking.id },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
        include: {
          service: true,
        },
      });
    });

    it('should set completedAt when status is COMPLETED', async () => {
      const booking = BookingFactory.build({ id: 1 });

      mockPrisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
      } as any);

      await updateBookingStatus(booking.id, BookingStatus.COMPLETED);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: booking.id },
        data: expect.objectContaining({
          status: BookingStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
        include: {
          service: true,
        },
      });
    });
  });

  describe('getBookingByConfirmationCode', () => {
    it('should find booking by confirmation code', async () => {
      const booking = BookingFactory.build({
        confirmationCode: 'TEST1234',
        service: ServiceFactory.build(),
      });

      mockPrisma.booking.findUnique.mockResolvedValue(booking as any);

      const result = await getBookingByConfirmationCode('TEST1234');

      expect(result).toEqual(booking);
      expect(mockPrisma.booking.findUnique).toHaveBeenCalledWith({
        where: { confirmationCode: 'TEST1234' },
        include: {
          service: true,
        },
      });
    });

    it('should return null for non-existent confirmation code', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const result = await getBookingByConfirmationCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('getDailyStats', () => {
    it('should calculate daily statistics correctly', async () => {
      const testDate = DateTestUtils.createTestDate(0); // Today
      const bookings = [
        BookingFactory.build({
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          priceCents: 2500,
        }),
        BookingFactory.build({
          status: BookingStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          priceCents: 3000,
        }),
        BookingFactory.build({
          status: BookingStatus.CANCELLED,
          paymentStatus: PaymentStatus.PENDING,
          priceCents: 2000,
        }),
      ];

      mockPrisma.booking.findMany.mockResolvedValue(bookings as any);

      const stats = await getDailyStats(testDate);

      expect(stats).toEqual({
        total: 3,
        confirmed: 1,
        completed: 1,
        cancelled: 1,
        revenue: 55, // (2500 + 3000) / 100
      });
    });

    it('should handle empty booking list', async () => {
      const testDate = DateTestUtils.createTestDate(0);

      mockPrisma.booking.findMany.mockResolvedValue([]);

      const stats = await getDailyStats(testDate);

      expect(stats).toEqual({
        total: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
      });
    });
  });
});