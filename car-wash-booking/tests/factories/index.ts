/**
 * Test Data Factories
 * Enterprise-grade test data generation
 */

import { BookingStatus, PaymentStatus, Service, Booking, User, StaffRole } from '@prisma/client';

/**
 * Base factory interface
 */
interface Factory<T> {
  build(overrides?: Partial<T>): T;
  buildList(count: number, overrides?: Partial<T>): T[];
}

/**
 * Service Factory
 */
export const ServiceFactory: Factory<Service> = {
  build(overrides = {}): Service {
    const defaults: Service = {
      id: Math.floor(Math.random() * 1000) + 1,
      titleFi: 'Peruspesu',
      titleEn: 'Basic Wash',
      descriptionFi: 'Perusteellinen auton pesu',
      descriptionEn: 'Comprehensive car wash',
      priceCents: 2500, // €25.00
      durationMinutes: 60,
      capacity: 1,
      image: '/images/basic-wash.jpg',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...defaults, ...overrides };
  },

  buildList(count: number, overrides = {}): Service[] {
    return Array.from({ length: count }, (_, index) =>
      this.build({ ...overrides, id: index + 1 })
    );
  },
};

/**
 * Booking Factory
 */
export const BookingFactory: Factory<Booking> = {
  build(overrides = {}): Booking {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1); // Tomorrow
    baseDate.setHours(10, 0, 0, 0); // 10:00 AM

    const defaults: Booking = {
      id: Math.floor(Math.random() * 1000) + 1,
      serviceId: 1,
      vehicleType: 'sedan',
      date: baseDate,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      priceCents: 2500,
      status: BookingStatus.PENDING,
      customerName: 'Matti Meikäläinen',
      customerEmail: 'matti@example.com',
      customerPhone: '+358401234567',
      notes: null,
      paymentStatus: PaymentStatus.PENDING,
      paymentIntentId: null,
      stripeSessionId: null,
      confirmationCode: 'TEST1234',
      adminNotes: null,
      cancelledAt: null,
      completedAt: null,
      notificationsSent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeSlotId: null,
      licensePlate: 'ABC-123',
      assignedStaffId: null,
      assignedBayId: null,
      assignedAt: null,
      assignedBy: null,
      cancellationReason: null,
      guestCount: 1,
      statusHistory: null,
    };

    return { ...defaults, ...overrides };
  },

  buildList(count: number, overrides = {}): Booking[] {
    return Array.from({ length: count }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);

      return this.build({
        ...overrides,
        id: index + 1,
        confirmationCode: `TEST${String(index + 1).padStart(4, '0')}`,
        date,
      });
    });
  },
};

/**
 * User Factory
 */
export const UserFactory: Factory<User> = {
  build(overrides = {}): User {
    const defaults: User = {
      id: Math.floor(Math.random() * 1000) + 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZdZiLvE3D4.e', // "password"
      createdAt: new Date(),
    };

    return { ...defaults, ...overrides };
  },

  buildList(count: number, overrides = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      this.build({
        ...overrides,
        id: index + 1,
        email: `test${index + 1}@example.com`,
      })
    );
  },
};

/**
 * Staff Factory
 */
export const StaffFactory = {
  build(overrides = {}) {
    const defaults = {
      id: Math.floor(Math.random() * 1000) + 1,
      name: 'Test Staff',
      email: 'staff@example.com',
      phone: '+358401234567',
      role: StaffRole.OPERATOR,
      isActive: true,
      specialties: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...defaults, ...overrides };
  },

  buildList(count: number, overrides = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.build({
        ...overrides,
        id: index + 1,
        email: `staff${index + 1}@example.com`,
      })
    );
  },
};

/**
 * API Request Factory
 */
export const ApiRequestFactory = {
  booking(overrides = {}) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const defaults = {
      serviceId: 1,
      vehicleType: 'sedan',
      date: tomorrow.toISOString().split('T')[0],
      startTime: '10:00',
      customerName: 'Matti Meikäläinen',
      customerEmail: 'matti@example.com',
      customerPhone: '+358401234567',
      licensePlate: 'ABC-123',
      notes: 'Test booking',
    };

    return { ...defaults, ...overrides };
  },

  service(overrides = {}) {
    const defaults = {
      titleFi: 'Test Palvelu',
      titleEn: 'Test Service',
      descriptionFi: 'Testipalvelun kuvaus',
      descriptionEn: 'Test service description',
      priceCents: 2500,
      durationMinutes: 60,
      capacity: 1,
      isActive: true,
    };

    return { ...defaults, ...overrides };
  },
};

/**
 * Mock API Response Factory
 */
export const ApiResponseFactory = {
  success<T>(data: T, message = 'Success') {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  },

  error(message: string, code = 'UNKNOWN_ERROR', details?: any) {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  },

  validation(errors: Array<{ field: string; message: string }>) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
      },
      timestamp: new Date().toISOString(),
    };
  },
};

/**
 * Random data generators
 */
export const Generators = {
  email: (domain = 'example.com') =>
    `test${Math.random().toString(36).substring(7)}@${domain}`,

  phone: () => `+35840${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,

  licensePlate: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    return `${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}-${numbers[Math.floor(Math.random() * numbers.length)]}${numbers[Math.floor(Math.random() * numbers.length)]}${numbers[Math.floor(Math.random() * numbers.length)]}`;
  },

  confirmationCode: () =>
    Math.random().toString(36).substring(2, 10).toUpperCase(),

  futureDate: (daysFromNow = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  },

  pastDate: (daysAgo = 1) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  },
};