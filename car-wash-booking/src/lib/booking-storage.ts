// Frontend booking storage using localStorage
// Provides immediate booking functionality while API issues are resolved

export interface BookingData {
  id: string;
  confirmationCode: string;
  serviceId: number;
  serviceName: string;
  servicePrice: string;
  vehicleType: string;
  date: string;
  time: string;
  duration: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  licensePlate?: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED';
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate available time slots for a date
export function generateTimeSlots(date: string, serviceId: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const businessStart = 9; // 9 AM
  const businessEnd = 18;  // 6 PM

  // Get existing bookings for this date
  const existingBookings = getBookingsForDate(date);

  for (let hour = businessStart; hour < businessEnd; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    // Check if this time slot is already booked
    const isBooked = existingBookings.some(booking =>
      booking.time === timeStr && booking.serviceId === serviceId
    );

    // Check if it's in the past (for today only)
    const now = new Date();
    const today = new Date().toISOString().split('T')[0];
    const isPast = date === today && hour <= now.getHours();

    slots.push({
      time: timeStr,
      available: !isBooked && !isPast
    });
  }

  return slots;
}

// Save booking to localStorage
export function saveBooking(bookingData: Omit<BookingData, 'id' | 'confirmationCode' | 'status' | 'createdAt'>): BookingData {
  const id = Date.now().toString();
  const confirmationCode = generateConfirmationCode();

  const booking: BookingData = {
    ...bookingData,
    id,
    confirmationCode,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  // Get existing bookings
  const existingBookings = getAllBookings();
  existingBookings.push(booking);

  // Save to localStorage
  localStorage.setItem('carwash_bookings', JSON.stringify(existingBookings));

  return booking;
}

// Get all bookings from localStorage
export function getAllBookings(): BookingData[] {
  if (typeof window === 'undefined') return []; // SSR safety

  try {
    const stored = localStorage.getItem('carwash_bookings');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading bookings from localStorage:', error);
    return [];
  }
}

// Get bookings for a specific date
export function getBookingsForDate(date: string): BookingData[] {
  return getAllBookings().filter(booking => booking.date === date);
}

// Get booking by confirmation code
export function getBookingByConfirmationCode(code: string): BookingData | undefined {
  return getAllBookings().find(booking => booking.confirmationCode === code);
}

// Get booking by ID
export function getBookingById(id: string): BookingData | undefined {
  return getAllBookings().find(booking => booking.id === id);
}

// Clear all bookings (for testing)
export function clearAllBookings(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('carwash_bookings');
  }
}

// Export bookings as JSON (for when API is working)
export function exportBookings(): string {
  return JSON.stringify(getAllBookings(), null, 2);
}