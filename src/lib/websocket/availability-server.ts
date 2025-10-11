/**
 * Real-Time Availability WebSocket Server
 * Manages live booking availability updates
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { prisma } from '../database/config';
import { redisService } from '../redis-service';
import { logger } from '../logger';

export interface AvailabilityUpdate {
  date: string;
  timeSlot: string;
  serviceId: number;
  available: boolean;
  capacity: number;
  currentBookings: number;
  bayId?: number;
}

export interface BookingConflict {
  timeSlot: string;
  conflictType: 'capacity_full' | 'bay_unavailable' | 'maintenance';
  message: string;
}

class AvailabilityServer {
  private static instance: AvailabilityServer;
  private io: SocketServer | null = null;
  private connectedClients = new Map<string, Socket>();
  private roomSubscriptions = new Map<string, Set<string>>(); // room -> client IDs

  static getInstance(): AvailabilityServer {
    if (!AvailabilityServer.instance) {
      AvailabilityServer.instance = new AvailabilityServer();
    }
    return AvailabilityServer.instance;
  }

  initialize(httpServer: HTTPServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      path: '/api/ws/availability',
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    logger.info('Availability WebSocket server initialized');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info('Client connected to availability server', { socketId: socket.id });
      this.connectedClients.set(socket.id, socket);

      // Handle room subscriptions
      socket.on('subscribe_availability', (data: { date: string; serviceId?: number }) => {
        const room = this.getRoomName(data.date, data.serviceId);
        socket.join(room);

        // Track subscription
        if (!this.roomSubscriptions.has(room)) {
          this.roomSubscriptions.set(room, new Set());
        }
        this.roomSubscriptions.get(room)!.add(socket.id);

        logger.info('Client subscribed to availability', {
          socketId: socket.id,
          room,
          date: data.date,
          serviceId: data.serviceId
        });

        // Send current availability data
        this.sendCurrentAvailability(socket, data.date, data.serviceId);
      });

      socket.on('unsubscribe_availability', (data: { date: string; serviceId?: number }) => {
        const room = this.getRoomName(data.date, data.serviceId);
        socket.leave(room);

        // Remove from subscription tracking
        const roomSubs = this.roomSubscriptions.get(room);
        if (roomSubs) {
          roomSubs.delete(socket.id);
          if (roomSubs.size === 0) {
            this.roomSubscriptions.delete(room);
          }
        }

        logger.info('Client unsubscribed from availability', {
          socketId: socket.id,
          room
        });
      });

      // Handle booking attempt (for conflict detection)
      socket.on('attempt_booking', async (data: {
        date: string;
        timeSlot: string;
        serviceId: number;
        customerId?: number;
      }) => {
        await this.handleBookingAttempt(socket, data);
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from availability server', { socketId: socket.id });
        this.connectedClients.delete(socket.id);

        // Clean up subscriptions
        for (const [room, clients] of this.roomSubscriptions.entries()) {
          clients.delete(socket.id);
          if (clients.size === 0) {
            this.roomSubscriptions.delete(room);
          }
        }
      });
    });
  }

  private getRoomName(date: string, serviceId?: number): string {
    return serviceId ? `availability:${date}:${serviceId}` : `availability:${date}`;
  }

  private async sendCurrentAvailability(socket: Socket, date: string, serviceId?: number) {
    try {
      const availability = await this.getAvailabilityData(date, serviceId);
      socket.emit('availability_update', availability);
    } catch (error) {
      logger.error('Error sending current availability', {
        error: error instanceof Error ? error.message : String(error),
        date,
        serviceId,
      });
    }
  }

  private async getAvailabilityData(date: string, serviceId?: number) {
    // Try cache first
    const cacheKey = `availability:${date}${serviceId ? `:${serviceId}` : ''}`;
    let availability = await redisService.get(cacheKey);

    if (!availability) {
      // Query database
      const timeSlots = await prisma.timeSlot.findMany({
        where: {
          date: new Date(date),
          isAvailable: true,
          ...(serviceId && { /* Add service-specific filtering if needed */ }),
        },
        include: {
          bookings: {
            where: {
              status: {
                in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
              },
              ...(serviceId && { serviceId }),
            },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      availability = timeSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxCapacity: slot.maxCapacity,
        currentBookings: slot.bookings.length,
        available: slot.currentBookings < slot.maxCapacity,
        isHoliday: slot.isHoliday,
      }));

      // Cache for 2 minutes
      await redisService.set(cacheKey, availability, { ttl: 120 });
    }

    return availability;
  }

  private async handleBookingAttempt(socket: Socket, data: {
    date: string;
    timeSlot: string;
    serviceId: number;
    customerId?: number;
  }) {
    try {
      // Check real-time availability
      const conflicts = await this.checkBookingConflicts(data);

      if (conflicts.length > 0) {
        socket.emit('booking_conflict', {
          timeSlot: data.timeSlot,
          conflicts,
        });
        return;
      }

      // Create temporary hold (5 minutes)
      const holdResult = await this.createTemporaryHold(data);

      if (holdResult.success) {
        socket.emit('booking_hold_created', {
          holdId: holdResult.holdId,
          expiresAt: holdResult.expiresAt,
          timeSlot: data.timeSlot,
        });

        // Broadcast availability update to other clients
        await this.broadcastAvailabilityUpdate(data.date, data.serviceId);
      } else {
        socket.emit('booking_conflict', {
          timeSlot: data.timeSlot,
          conflicts: [{
            conflictType: 'capacity_full' as const,
            message: 'Time slot no longer available'
          }],
        });
      }
    } catch (error) {
      logger.error('Error handling booking attempt', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });

      socket.emit('booking_error', {
        message: 'Unable to process booking attempt',
      });
    }
  }

  private async checkBookingConflicts(data: {
    date: string;
    timeSlot: string;
    serviceId: number;
  }): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = [];

    // Find the time slot
    const timeSlot = await prisma.timeSlot.findFirst({
      where: {
        date: new Date(data.date),
        startTime: data.timeSlot,
      },
      include: {
        bookings: {
          where: {
            serviceId: data.serviceId,
            status: {
              in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
            },
          },
        },
      },
    });

    if (!timeSlot) {
      conflicts.push({
        timeSlot: data.timeSlot,
        conflictType: 'capacity_full',
        message: 'Time slot not found',
      });
      return conflicts;
    }

    // Check capacity
    if (timeSlot.bookings.length >= timeSlot.maxCapacity) {
      conflicts.push({
        timeSlot: data.timeSlot,
        conflictType: 'capacity_full',
        message: 'Time slot is fully booked',
      });
    }

    // Check if slot is available
    if (!timeSlot.isAvailable) {
      conflicts.push({
        timeSlot: data.timeSlot,
        conflictType: 'maintenance',
        message: 'Time slot is temporarily unavailable',
      });
    }

    // Check bay availability (if needed)
    const availableBays = await prisma.washBay.count({
      where: {
        isEnabled: true,
        bookings: {
          none: {
            date: new Date(data.date),
            startTime: data.timeSlot,
            status: {
              in: ['CONFIRMED', 'IN_PROGRESS'],
            },
          },
        },
      },
    });

    if (availableBays === 0) {
      conflicts.push({
        timeSlot: data.timeSlot,
        conflictType: 'bay_unavailable',
        message: 'No wash bays available for this time slot',
      });
    }

    return conflicts;
  }

  private async createTemporaryHold(data: {
    date: string;
    timeSlot: string;
    serviceId: number;
    customerId?: number;
  }) {
    const holdId = `hold:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    try {
      // Store hold in Redis
      await redisService.set(
        holdId,
        {
          ...data,
          expiresAt: expiresAt.toISOString(),
          createdAt: new Date().toISOString(),
        },
        { ttl: 300 } // 5 minutes
      );

      return {
        success: true,
        holdId,
        expiresAt,
      };
    } catch (error) {
      logger.error('Error creating temporary hold', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });

      return {
        success: false,
        error: 'Failed to create hold',
      };
    }
  }

  /**
   * Broadcast availability update when bookings change
   */
  async broadcastAvailabilityUpdate(date: string, serviceId?: number) {
    if (!this.io) return;

    try {
      // Invalidate cache
      const cacheKey = `availability:${date}${serviceId ? `:${serviceId}` : ''}`;
      await redisService.delete(cacheKey);

      // Get updated availability
      const availability = await this.getAvailabilityData(date, serviceId);

      // Broadcast to relevant rooms
      const room = this.getRoomName(date, serviceId);
      this.io.to(room).emit('availability_update', availability);

      // Also broadcast to general date room if this was service-specific
      if (serviceId) {
        const generalRoom = this.getRoomName(date);
        this.io.to(generalRoom).emit('availability_update', availability);
      }

      logger.info('Broadcasted availability update', {
        date,
        serviceId,
        room,
        clientCount: this.roomSubscriptions.get(room)?.size || 0
      });
    } catch (error) {
      logger.error('Error broadcasting availability update', {
        error: error instanceof Error ? error.message : String(error),
        date,
        serviceId,
      });
    }
  }

  /**
   * Handle booking confirmation (remove hold, update availability)
   */
  async handleBookingConfirmed(bookingData: {
    date: string;
    timeSlot: string;
    serviceId: number;
    holdId?: string;
  }) {
    // Remove hold if exists
    if (bookingData.holdId) {
      await redisService.delete(bookingData.holdId);
    }

    // Broadcast availability update
    await this.broadcastAvailabilityUpdate(bookingData.date, bookingData.serviceId);
  }

  /**
   * Handle booking cancellation
   */
  async handleBookingCancelled(bookingData: {
    date: string;
    serviceId: number;
  }) {
    await this.broadcastAvailabilityUpdate(bookingData.date, bookingData.serviceId);
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.connectedClients.size,
      activeRooms: this.roomSubscriptions.size,
      roomSubscriptions: Object.fromEntries(
        Array.from(this.roomSubscriptions.entries()).map(([room, clients]) => [
          room,
          clients.size,
        ])
      ),
    };
  }
}

export const availabilityServer = AvailabilityServer.getInstance();
export default availabilityServer;