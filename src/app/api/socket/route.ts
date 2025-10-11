/**
 * WebSocket Server for Real-Time Booking Features
 * Handles availability updates, booking conflicts, and real-time notifications
 */

import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { prisma } from '@/lib/prisma-simple';
import { cache } from '@/lib/redis';

// Global variable to store the Socket.IO server instance
let io: SocketIOServer | null = null;

// Configuration for production deployment
const WEBSOCKET_CONFIG: any = {
  cors: {
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://*.onrender.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    pingTimeout: 30000,
    pingInterval: 15000,
    maxHttpBufferSize: 1e6, // 1MB
    allowRequest: (req: any, callback: any) => {
      // Validate origin in production
      const origin = req.headers.origin;
      const allowed = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [];
      const isAllowed = allowed.some(allowedOrigin => {
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return allowedOrigin === origin;
      });
      callback(null, isAllowed);
    }
  })
};

// Interface definitions
interface BookingHold {
  holdId: string;
  userId: string;
  date: string;
  timeSlot: string;
  serviceId: number;
  expiresAt: Date;
}

interface AvailabilityData {
  date: string;
  timeSlots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    currentBookings: number;
    availableCapacity: number;
    isAvailable: boolean;
    availableBays: number;
    conflicts: Array<{
      type: string;
      message: string;
    }>;
  }>;
  summary: {
    totalSlots: number;
    availableSlots: number;
    fullyBookedSlots: number;
  };
}

// Booking holds management using Redis
class BookingHoldManager {
  private static HOLD_DURATION = 5 * 60 * 1000; // 5 minutes

  static async createHold(
    userId: string,
    date: string,
    timeSlot: string,
    serviceId: number
  ): Promise<BookingHold | null> {
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + this.HOLD_DURATION);

    const hold: BookingHold = {
      holdId,
      userId,
      date,
      timeSlot,
      serviceId,
      expiresAt
    };

    const key = `booking_hold:${date}:${timeSlot}`;
    const success = await cache.set(key, hold, Math.floor(this.HOLD_DURATION / 1000));

    if (success) {
      // Set up automatic expiry cleanup
      setTimeout(() => {
        this.expireHold(holdId, date, timeSlot);
      }, this.HOLD_DURATION);

      return hold;
    }

    return null;
  }

  static async getHold(date: string, timeSlot: string): Promise<BookingHold | null> {
    const key = `booking_hold:${date}:${timeSlot}`;
    return await cache.get<BookingHold>(key);
  }

  static async releaseHold(date: string, timeSlot: string): Promise<boolean> {
    const key = `booking_hold:${date}:${timeSlot}`;
    return await cache.del(key);
  }

  static async expireHold(holdId: string, date: string, timeSlot: string): Promise<void> {
    await this.releaseHold(date, timeSlot);

    if (io) {
      io.to(`availability:${date}`).emit('booking_hold_expired', {
        holdId,
        timeSlot,
        date
      });
    }
  }
}

// Availability calculation
class AvailabilityService {
  static async calculateAvailability(date: string, serviceId?: number): Promise<AvailabilityData> {
    try {
      // Get business hours for the day
      const dayOfWeek = new Date(date).getDay();
      const businessHours = await prisma.businessHours.findUnique({
        where: { dayOfWeek }
      });

      if (!businessHours || !businessHours.isOpen) {
        return {
          date,
          timeSlots: [],
          summary: { totalSlots: 0, availableSlots: 0, fullyBookedSlots: 0 }
        };
      }

      // Generate time slots based on business hours
      const timeSlots = await this.generateTimeSlots(date, businessHours, serviceId);

      // Calculate summary
      const summary = {
        totalSlots: timeSlots.length,
        availableSlots: timeSlots.filter(slot => slot.isAvailable).length,
        fullyBookedSlots: timeSlots.filter(slot => !slot.isAvailable).length
      };

      return { date, timeSlots, summary };
    } catch (error) {
      console.error('Error calculating availability:', error);
      return {
        date,
        timeSlots: [],
        summary: { totalSlots: 0, availableSlots: 0, fullyBookedSlots: 0 }
      };
    }
  }

  private static async generateTimeSlots(
    date: string,
    businessHours: any,
    serviceId?: number
  ): Promise<AvailabilityData['timeSlots']> {
    const slots = [];
    const slotDuration = 30; // 30 minutes per slot

    const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = businessHours.endTime.split(':').map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      const timeSlot = {
        id: `${date}_${currentTime.getHours()}_${currentTime.getMinutes()}`,
        startTime: currentTime.toTimeString().slice(0, 5),
        endTime: slotEnd.toTimeString().slice(0, 5),
        maxCapacity: 2, // Default capacity
        currentBookings: 0,
        availableCapacity: 2,
        isAvailable: true,
        availableBays: 2,
        conflicts: [] as Array<{ type: string; message: string }>
      };

      // Check existing bookings for this time slot
      const existingBookings = await prisma.booking.findMany({
        where: {
          date: new Date(date),
          startTime: timeSlot.startTime,
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
          },
          ...(serviceId && { serviceId })
        },
        include: {
          service: true
        }
      });

      timeSlot.currentBookings = existingBookings.length;
      timeSlot.availableCapacity = Math.max(0, timeSlot.maxCapacity - timeSlot.currentBookings);
      timeSlot.isAvailable = timeSlot.availableCapacity > 0;
      timeSlot.availableBays = Math.max(0, 2 - timeSlot.currentBookings);

      // Check for conflicts
      const conflicts = await this.checkConflicts(date, timeSlot.startTime, serviceId);
      timeSlot.conflicts = conflicts;

      if (conflicts.length > 0) {
        timeSlot.isAvailable = false;
      }

      slots.push(timeSlot);
      currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }

    return slots;
  }

  private static async checkConflicts(
    date: string,
    timeSlot: string,
    _serviceId?: number
  ): Promise<Array<{ type: string; message: string }>> {
    const conflicts = [];

    // Check for holidays
    const holiday = await prisma.holiday.findUnique({
      where: { date: new Date(date) }
    });

    if (holiday) {
      conflicts.push({
        type: 'holiday',
        message: `Closed for ${holiday.name}`
      });
    }

    // Check for maintenance blocks
    // This could be extended with a maintenance schedule table

    // Check for booking holds
    const hold = await BookingHoldManager.getHold(date, timeSlot);
    if (hold && hold.expiresAt > new Date()) {
      conflicts.push({
        type: 'hold',
        message: 'Temporarily reserved'
      });
    }

    return conflicts;
  }
}

// Socket.IO event handlers
function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Rate limiting per socket
    const rateLimiter = new Map<string, number>();

    socket.on('subscribe_availability', async (data: { date: string; serviceId?: number }) => {
      // Rate limiting
      const now = Date.now();
      const lastRequest = rateLimiter.get('subscribe') || 0;
      if (now - lastRequest < 1000) { // 1 second cooldown
        socket.emit('rate_limited', { message: 'Too many requests' });
        return;
      }
      rateLimiter.set('subscribe', now);

      try {
        const { date, serviceId } = data;

        // Validate date
        if (!date || isNaN(Date.parse(date))) {
          socket.emit('error', { message: 'Invalid date format' });
          return;
        }

        // Join room for this date
        socket.join(`availability:${date}`);

        // Send current availability
        const availability = await AvailabilityService.calculateAvailability(date, serviceId);
        socket.emit('availability_update', availability);

        console.log(`Client ${socket.id} subscribed to availability for ${date}`);
      } catch (error) {
        console.error('Error in subscribe_availability:', error);
        socket.emit('error', { message: 'Failed to subscribe to availability' });
      }
    });

    socket.on('unsubscribe_availability', (data: { date: string; serviceId?: number }) => {
      try {
        const { date } = data;
        socket.leave(`availability:${date}`);
        console.log(`Client ${socket.id} unsubscribed from availability for ${date}`);
      } catch (error) {
        console.error('Error in unsubscribe_availability:', error);
      }
    });

    socket.on('attempt_booking', async (data: { date: string; timeSlot: string; serviceId: number }) => {
      // Rate limiting
      const now = Date.now();
      const lastRequest = rateLimiter.get('attempt_booking') || 0;
      if (now - lastRequest < 2000) { // 2 second cooldown
        socket.emit('rate_limited', { message: 'Please wait before attempting another booking' });
        return;
      }
      rateLimiter.set('attempt_booking', now);

      try {
        const { date, timeSlot, serviceId } = data;
        const userId = socket.id; // In production, get from authentication

        // Check if slot is still available
        const availability = await AvailabilityService.calculateAvailability(date, serviceId);
        const slot = availability.timeSlots.find(s => s.startTime === timeSlot);

        if (!slot || !slot.isAvailable || slot.conflicts.length > 0) {
          socket.emit('booking_conflict', {
            timeSlot,
            conflicts: slot?.conflicts || [{ type: 'unavailable', message: 'Time slot no longer available' }]
          });
          return;
        }

        // Create booking hold
        const hold = await BookingHoldManager.createHold(userId, date, timeSlot, serviceId);

        if (hold) {
          socket.emit('booking_hold_created', {
            holdId: hold.holdId,
            expiresAt: hold.expiresAt.toISOString(),
            timeSlot: hold.timeSlot
          });

          // Notify other clients about the hold
          socket.to(`availability:${date}`).emit('availability_update',
            await AvailabilityService.calculateAvailability(date, serviceId)
          );
        } else {
          socket.emit('booking_error', { message: 'Failed to reserve time slot' });
        }
      } catch (error) {
        console.error('Error in attempt_booking:', error);
        socket.emit('booking_error', { message: 'Booking attempt failed' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

// Initialize Socket.IO server
function initializeSocketIO(server: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, WEBSOCKET_CONFIG);

  setupSocketHandlers(io);

  console.log('Socket.IO server initialized');
  return io;
}

// API route handler for WebSocket upgrade
export async function GET(_request: NextRequest) {
  // This endpoint is used for WebSocket handshake
  // The actual Socket.IO server is initialized elsewhere
  return new Response('WebSocket endpoint', { status: 200 });
}

// Utility function to broadcast availability updates
export async function broadcastAvailabilityUpdate(date: string, serviceId?: number) {
  if (!io) return;

  try {
    const availability = await AvailabilityService.calculateAvailability(date, serviceId);
    io.to(`availability:${date}`).emit('availability_update', availability);
  } catch (error) {
    console.error('Error broadcasting availability update:', error);
  }
}

// Export for use in other parts of the application
export { initializeSocketIO, AvailabilityService, BookingHoldManager };