// Business configuration
export const BUSINESS_HOURS = {
  START_HOUR: 8,
  END_HOUR: 18,
  CLOSED_DAYS: [0], // Sunday = 0
  SLOT_INTERVAL: 30, // minutes
  MAX_CONCURRENT_SERVICES: 2 // How many services can run at the same time
};

// Mock booked slots - in real app, this would come from database
const mockBookedSlots: Record<string, string[]> = {
  // Format: 'YYYY-MM-DD': ['HH:MM', 'HH:MM']
};

export interface TimeSlot {
  time: string;
  available: boolean;
  duration: number;
  conflictsWith?: string[];
}

export function generateTimeSlots(date: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const selectedDate = new Date(date);

  // Check if it's a closed day
  if (BUSINESS_HOURS.CLOSED_DAYS.includes(selectedDate.getDay())) {
    return slots;
  }

  // Get booked slots for this date
  const bookedSlots = mockBookedSlots[date] || [];

  for (let hour = BUSINESS_HOURS.START_HOUR; hour < BUSINESS_HOURS.END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += BUSINESS_HOURS.SLOT_INTERVAL) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Check if this slot conflicts with any booked slots
      const isBooked = bookedSlots.includes(time);

      // Check if it's in the past (for today's date)
      const now = new Date();
      const slotDateTime = new Date(date);
      slotDateTime.setHours(hour, minute);
      const isPast = slotDateTime < now;

      // Slot is available if:
      // - Not booked
      // - Not in the past
      // - Business is open
      const available = !isBooked && !isPast;

      slots.push({
        time,
        available,
        duration: 30 // Standard 30-minute slots
      });
    }
  }

  return slots;
}

// Function to book a slot (in real app, this would update database)
export function bookTimeSlot(date: string, time: string): boolean {
  if (!mockBookedSlots[date]) {
    mockBookedSlots[date] = [];
  }

  if (!mockBookedSlots[date].includes(time)) {
    mockBookedSlots[date].push(time);
    return true;
  }

  return false;
}

// Function to check if a specific slot is available
export function isSlotAvailable(date: string, time: string): boolean {
  const slots = generateTimeSlots(date);
  const slot = slots.find(s => s.time === time);
  return slot?.available || false;
}

// Get next available slots for quick booking
export function getNextAvailableSlots(daysToCheck: number = 7): Array<{date: string, time: string}> {
  const availableSlots: Array<{date: string, time: string}> = [];
  const today = new Date();

  for (let i = 1; i <= daysToCheck; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dateString = checkDate.toISOString().split('T')[0];

    const slots = generateTimeSlots(dateString);
    const firstAvailable = slots.find(slot => slot.available);

    if (firstAvailable) {
      availableSlots.push({
        date: dateString,
        time: firstAvailable.time
      });
    }
  }

  return availableSlots.slice(0, 5); // Return first 5 available slots
}