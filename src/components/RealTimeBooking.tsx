/**
 * Real-Time Booking Component
 * Provides live availability updates and conflict detection
 */

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, Loader, Wifi, WifiOff } from 'lucide-react';

interface TimeSlot {
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
}

interface AvailabilityData {
  date: string;
  timeSlots: TimeSlot[];
  summary: {
    totalSlots: number;
    availableSlots: number;
    fullyBookedSlots: number;
  };
}

interface BookingHold {
  holdId: string;
  expiresAt: string;
  timeSlot: string;
}

interface RealTimeBookingProps {
  selectedDate: string;
  serviceId?: number;
  onTimeSlotSelect: (timeSlot: string) => void;
  onAvailabilityChange?: (availability: AvailabilityData) => void;
}

export default function RealTimeBooking({
  selectedDate,
  serviceId,
  onTimeSlotSelect,
  onAvailabilityChange,
}: RealTimeBookingProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingHold, setBookingHold] = useState<BookingHold | null>(null);
  const [holdTimer, setHoldTimer] = useState<number | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || '', {
      path: '/api/ws/availability',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      setError('Connection failed: ' + error.message);
      setIsConnected(false);
    });

    newSocket.on('availability_update', (data: AvailabilityData) => {
      setAvailability(data);
      onAvailabilityChange?.(data);
      setLoading(false);
    });

    newSocket.on('booking_conflict', (data: { timeSlot: string; conflicts: any[] }) => {
      setError(`Booking conflict for ${data.timeSlot}: ${data.conflicts[0]?.message || 'Unknown conflict'}`);
      setSelectedSlot(null);
    });

    newSocket.on('booking_hold_created', (data: BookingHold) => {
      setBookingHold(data);
      startHoldTimer(data.expiresAt);
    });

    newSocket.on('booking_error', (data: { message: string }) => {
      setError(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [onAvailabilityChange]);

  // Subscribe to availability updates when date or service changes
  useEffect(() => {
    if (socket && isConnected && selectedDate) {
      setLoading(true);
      socket.emit('subscribe_availability', { date: selectedDate, serviceId });

      return () => {
        socket.emit('unsubscribe_availability', { date: selectedDate, serviceId });
      };
    }
  }, [socket, isConnected, selectedDate, serviceId]);

  const startHoldTimer = useCallback((expiresAt: string) => {
    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeLeft = Math.max(0, expirationTime - now);

    if (holdTimer) {
      clearTimeout(holdTimer);
    }

    const timer = window.setTimeout(() => {
      setBookingHold(null);
      setSelectedSlot(null);
      setError('Booking hold expired. Please select a time slot again.');
    }, timeLeft);

    setHoldTimer(timer);
  }, [holdTimer]);

  const handleTimeSlotClick = (timeSlot: TimeSlot) => {
    if (!timeSlot.isAvailable || timeSlot.conflicts.length > 0) {
      return;
    }

    // Clear any existing hold
    if (bookingHold) {
      setBookingHold(null);
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    }

    setSelectedSlot(timeSlot.startTime);
    setError(null);

    // Attempt to create a booking hold
    if (socket && isConnected) {
      socket.emit('attempt_booking', {
        date: selectedDate,
        timeSlot: timeSlot.startTime,
        serviceId: serviceId || 1, // Default to service 1 if not specified
      });
    }

    onTimeSlotSelect(timeSlot.startTime);
  };

  const getSlotStatusColor = (timeSlot: TimeSlot) => {
    if (timeSlot.conflicts.length > 0) {
      return 'bg-red-100 border-red-300 text-red-700 cursor-not-allowed';
    }
    if (!timeSlot.isAvailable) {
      return 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed';
    }
    if (selectedSlot === timeSlot.startTime) {
      return 'bg-blue-100 border-blue-500 text-blue-700 ring-2 ring-blue-200';
    }
    if (timeSlot.availableCapacity <= 2) {
      return 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100';
    }
    return 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100';
  };

  const getSlotStatusIcon = (timeSlot: TimeSlot) => {
    if (timeSlot.conflicts.length > 0) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (!timeSlot.isAvailable) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (selectedSlot === timeSlot.startTime && bookingHold) {
      return <CheckCircle className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const formatTimeRemaining = () => {
    if (!bookingHold) return '';

    const expirationTime = new Date(bookingHold.expiresAt).getTime();
    const now = Date.now();
    const timeLeft = Math.max(0, expirationTime - now);

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading availability...</span>
      </div>
    );
  }

  if (error && !availability) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
          <span className={`text-sm ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
            {isConnected ? 'Real-time updates active' : 'Connection lost'}
          </span>
        </div>

        {availability && (
          <div className="text-sm text-gray-600">
            {availability.summary.availableSlots} of {availability.summary.totalSlots} slots available
          </div>
        )}
      </div>

      {/* Booking Hold Status */}
      {bookingHold && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-blue-700 font-medium">
                Time slot reserved: {bookingHold.timeSlot}
              </span>
            </div>
            <div className="text-blue-600 font-mono text-sm">
              {formatTimeRemaining()}
            </div>
          </div>
          <p className="text-blue-600 text-sm mt-1">
            Complete your booking within the time limit to secure this slot.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <span className="text-yellow-700">{error}</span>
          </div>
        </div>
      )}

      {/* Time Slots Grid */}
      {availability && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Available Times for {new Date(selectedDate).toLocaleDateString()}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availability.timeSlots.map((timeSlot) => (
              <button
                key={timeSlot.id}
                onClick={() => handleTimeSlotClick(timeSlot)}
                disabled={!timeSlot.isAvailable || timeSlot.conflicts.length > 0}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${getSlotStatusColor(timeSlot)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{timeSlot.startTime}</span>
                  {getSlotStatusIcon(timeSlot)}
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Capacity:</span>
                    <span className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {timeSlot.availableCapacity}/{timeSlot.maxCapacity}
                    </span>
                  </div>

                  {timeSlot.availableBays > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Bays:</span>
                      <span>{timeSlot.availableBays} available</span>
                    </div>
                  )}

                  {timeSlot.conflicts.length > 0 && (
                    <div className="text-red-600 mt-1">
                      {timeSlot.conflicts[0].message}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {availability.timeSlots.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No time slots available for this date.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}