/**
 * WebSocket Server Setup for Production Deployment
 * Handles Socket.IO integration with Next.js on Render
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './prisma-simple';
import { cache } from './redis';

let io: SocketIOServer | null = null;

// WebSocket configuration optimized for Render deployment
const WEBSOCKET_CONFIG = {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ALLOWED_ORIGINS?.split(',') || [process.env.NEXT_PUBLIC_SITE_URL || ''])
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    pingTimeout: 30000,
    pingInterval: 15000,
    maxHttpBufferSize: 1e6, // 1MB
    cleanupEmptyChildNamespaces: true,
    connectTimeout: 45000,
    serveClient: false,
  })
};

// Booking hold management with Redis
interface BookingHold {
  holdId: string;
  socketId: string;
  date: string;
  timeSlot: string;
  serviceId: number;
  expiresAt: Date;
}

class BookingHoldManager {
  private static HOLD_DURATION = 5 * 60 * 1000; // 5 minutes

  static async createHold(
    socketId: string,
    date: string,
    timeSlot: string,
    serviceId: number
  ): Promise<BookingHold | null> {
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + this.HOLD_DURATION);

    const hold: BookingHold = {
      holdId,
      socketId,
      date,
      timeSlot,
      serviceId,
      expiresAt
    };

    // Check if slot is already held
    const existingHold = await this.getHold(date, timeSlot);
    if (existingHold && existingHold.expiresAt > new Date()) {
      return null; // Slot is already held
    }

    const key = `booking_hold:${date}:${timeSlot}`;
    const success = await cache.set(key, hold, Math.floor(this.HOLD_DURATION / 1000));

    if (success) {
      // Set up automatic expiry
      setTimeout(() => {
        this.expireHold(holdId, date, timeSlot);
      }, this.HOLD_DURATION);

      return hold;
    }

    return null;
  }

  static async getHold(date: string, timeSlot: string): Promise<BookingHold | null> {
    const key = `booking_hold:${date}:${timeSlot}`;
    const hold = await cache.get<BookingHold>(key);

    if (hold && new Date(hold.expiresAt) <= new Date()) {
      // Hold has expired, clean it up
      await this.releaseHold(date, timeSlot);
      return null;
    }

    return hold;
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

      // Broadcast updated availability
      const availability = await AvailabilityService.calculateAvailability(date);
      io.to(`availability:${date}`).emit('availability_update', availability);
    }
  }
}

// Real-time availability service
class AvailabilityService {
  static async calculateAvailability(date: string, serviceId?: number) {
    try {
      const dayOfWeek = new Date(date).getDay();

      // Get business hours
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

      // Generate time slots
      const timeSlots = await this.generateTimeSlots(date, businessHours, serviceId);

      const summary = {
        totalSlots: timeSlots.length,
        availableSlots: timeSlots.filter(slot => slot.isAvailable).length,
        fullyBookedSlots: timeSlots.filter(slot => !slot.isAvailable).length
      };

      return { date, timeSlots, summary };
    } catch (error) {
      console.error('Error calculating availability:', error);
      throw error;
    }
  }

  private static async generateTimeSlots(date: string, businessHours: any, serviceId?: number) {
    const slots = [];
    const slotDuration = 30; // 30 minutes

    const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = businessHours.endTime.split(':').map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // Skip lunch break if defined
      if (businessHours.breakStart && businessHours.breakEnd) {
        const [breakStartHour, breakStartMinute] = businessHours.breakStart.split(':').map(Number);
        const [breakEndHour, breakEndMinute] = businessHours.breakEnd.split(':').map(Number);

        const breakStart = new Date(date);
        breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);

        const breakEnd = new Date(date);
        breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

        if (currentTime >= breakStart && currentTime < breakEnd) {
          currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
          continue;
        }
      }

      const timeSlot = {
        id: `${date}_${currentTime.getHours()}_${currentTime.getMinutes()}`,
        startTime: currentTime.toTimeString().slice(0, 5),
        endTime: slotEnd.toTimeString().slice(0, 5),
        maxCapacity: 2,
        currentBookings: 0,
        availableCapacity: 2,
        isAvailable: true,
        availableBays: 2,
        conflicts: [] as Array<{ type: string; message: string }>
      };

      // Check existing bookings
      const existingBookings = await prisma.booking.count({
        where: {
          date: new Date(date),
          startTime: timeSlot.startTime,
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
          },
          ...(serviceId && { serviceId })
        }
      });

      timeSlot.currentBookings = existingBookings;
      timeSlot.availableCapacity = Math.max(0, timeSlot.maxCapacity - existingBookings);
      timeSlot.availableBays = Math.max(0, 2 - existingBookings);

      // Check for holds
      const hold = await BookingHoldManager.getHold(date, timeSlot.startTime);
      if (hold) {
        timeSlot.availableCapacity = Math.max(0, timeSlot.availableCapacity - 1);
        timeSlot.conflicts.push({
          type: 'hold',
          message: 'Temporarily reserved'
        });
      }

      // Check for holidays
      const holiday = await prisma.holiday.findUnique({
        where: { date: new Date(date) }
      });

      if (holiday) {
        timeSlot.isAvailable = false;
        timeSlot.conflicts.push({
          type: 'holiday',
          message: `Closed for ${holiday.name}`
        });
      }

      timeSlot.isAvailable = timeSlot.availableCapacity > 0 && timeSlot.conflicts.length === 0;

      slots.push(timeSlot);
      currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }

    return slots;
  }
}

// Socket event handlers with rate limiting and validation
function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    const rateLimiter = new Map<string, number>();

    console.log(`Client connected: ${socket.id}`);

    // Rate limiting helper
    const checkRateLimit = (action: string, cooldown: number): boolean => {
      const now = Date.now();
      const lastRequest = rateLimiter.get(action) || 0;
      if (now - lastRequest < cooldown) {
        socket.emit('rate_limited', { message: 'Too many requests', action });
        return false;
      }
      rateLimiter.set(action, now);
      return true;
    };

    socket.on('subscribe_availability', async (data: { date: string; serviceId?: number }) => {
      if (!checkRateLimit('subscribe', 1000)) return;

      try {
        const { date, serviceId } = data;

        // Validate date
        if (!date || isNaN(Date.parse(date))) {
          socket.emit('booking_error', { message: 'Invalid date format' });
          return;
        }

        const targetDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (targetDate < today) {
          socket.emit('booking_error', { message: 'Cannot book for past dates' });
          return;
        }

        // Join room for this date
        await socket.join(`availability:${date}`);

        // Send current availability
        const availability = await AvailabilityService.calculateAvailability(date, serviceId);
        socket.emit('availability_update', availability);

        console.log(`Client ${socket.id} subscribed to availability for ${date}`);
      } catch (error) {
        console.error('Error in subscribe_availability:', error);
        socket.emit('booking_error', { message: 'Failed to subscribe to availability' });
      }
    });

    socket.on('unsubscribe_availability', async (data: { date: string }) => {
      try {
        const { date } = data;
        await socket.leave(`availability:${date}`);
        console.log(`Client ${socket.id} unsubscribed from availability for ${date}`);
      } catch (error) {
        console.error('Error in unsubscribe_availability:', error);
      }
    });

    socket.on('attempt_booking', async (data: { date: string; timeSlot: string; serviceId: number }) => {
      if (!checkRateLimit('attempt_booking', 2000)) return;

      try {
        const { date, timeSlot, serviceId } = data;

        // Validate input
        if (!date || !timeSlot || !serviceId) {
          socket.emit('booking_error', { message: 'Missing required booking information' });
          return;
        }

        // Check if slot is available
        const availability = await AvailabilityService.calculateAvailability(date, serviceId);
        const slot = availability.timeSlots.find(s => s.startTime === timeSlot);

        if (!slot) {
          socket.emit('booking_error', { message: 'Time slot not found' });
          return;
        }

        if (!slot.isAvailable || slot.conflicts.length > 0) {
          socket.emit('booking_conflict', {
            timeSlot,
            conflicts: slot.conflicts.length > 0
              ? slot.conflicts
              : [{ type: 'unavailable', message: 'Time slot no longer available' }]
          });
          return;
        }

        // Create booking hold
        const hold = await BookingHoldManager.createHold(socket.id, date, timeSlot, serviceId);

        if (hold) {
          socket.emit('booking_hold_created', {
            holdId: hold.holdId,
            expiresAt: hold.expiresAt.toISOString(),
            timeSlot: hold.timeSlot
          });

          // Broadcast updated availability to other clients
          const updatedAvailability = await AvailabilityService.calculateAvailability(date, serviceId);
          socket.to(`availability:${date}`).emit('availability_update', updatedAvailability);

          console.log(`Booking hold created: ${hold.holdId} for slot ${timeSlot} on ${date}`);
        } else {
          socket.emit('booking_error', { message: 'Time slot is already being held by another user' });
        }
      } catch (error) {
        console.error('Error in attempt_booking:', error);
        socket.emit('booking_error', { message: 'Booking attempt failed' });
      }
    });

    socket.on('release_hold', async (data: { date: string; timeSlot: string }) => {
      try {
        const { date, timeSlot } = data;
        const hold = await BookingHoldManager.getHold(date, timeSlot);

        if (hold && hold.socketId === socket.id) {
          await BookingHoldManager.releaseHold(date, timeSlot);

          // Broadcast updated availability
          const availability = await AvailabilityService.calculateAvailability(date);
          io.to(`availability:${date}`).emit('availability_update', availability);

          socket.emit('booking_hold_released', { timeSlot, date });
        }
      } catch (error) {
        console.error('Error releasing hold:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Clean up any holds for this socket
      // This is a simplified cleanup - in production you'd want to track holds per socket
      rateLimiter.clear();
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

// Initialize WebSocket server
export function initializeWebSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, WEBSOCKET_CONFIG);

  setupSocketHandlers(io);

  // Health check for WebSocket
  setInterval(() => {
    if (io) {
      const clientsCount = io.engine.clientsCount;
      console.log(`WebSocket server health: ${clientsCount} connected clients`);
    }
  }, 60000); // Every minute

  console.log('WebSocket server initialized for real-time booking features');
  return io;
}

// Utility function to broadcast availability updates from external sources
export async function broadcastAvailabilityUpdate(date: string, serviceId?: number) {
  if (!io) return;

  try {
    const availability = await AvailabilityService.calculateAvailability(date, serviceId);
    io.to(`availability:${date}`).emit('availability_update', availability);
    console.log(`Broadcasted availability update for ${date}`);
  } catch (error) {
    console.error('Error broadcasting availability update:', error);
  }
}

// Export services for use in API routes
export { AvailabilityService, BookingHoldManager };

// Get the current WebSocket server instance
export function getWebSocketServer(): SocketIOServer | null {
  return io;
}