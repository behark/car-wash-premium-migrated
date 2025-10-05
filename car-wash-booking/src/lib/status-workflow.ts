/**
 * Status Workflow Management - Inspired by TastyIgniter
 * Manages booking status transitions with validation and history tracking
 */

import { BookingStatus } from '@prisma/client';
import { prisma } from './prisma';
import { updateBookingStatus } from './booking-manager';

export interface StatusTransition {
  from: BookingStatus | null; // null means any status
  to: BookingStatus;
  label: string;
  requiresReason?: boolean;
  allowedBy: ('customer' | 'staff' | 'admin' | 'system')[];
  conditions?: (_booking: any) => boolean;
}

/**
 * Define allowed status transitions
 * Inspired by TastyIgniter's status workflow
 */
export const STATUS_WORKFLOW: StatusTransition[] = [
  // Initial creation
  {
    from: null,
    to: BookingStatus.PENDING,
    label: 'Create Booking',
    allowedBy: ['customer', 'admin', 'system'],
  },

  // Pending to Confirmed
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CONFIRMED,
    label: 'Confirm Booking',
    allowedBy: ['admin', 'staff', 'system'],
  },

  // Confirmed to In Progress
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.IN_PROGRESS,
    label: 'Start Service',
    allowedBy: ['staff', 'admin', 'system'],
  },

  // In Progress to Completed
  {
    from: BookingStatus.IN_PROGRESS,
    to: BookingStatus.COMPLETED,
    label: 'Complete Service',
    allowedBy: ['staff', 'admin', 'system'],
  },

  // Direct completion from confirmed (skip in-progress)
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.COMPLETED,
    label: 'Complete Service',
    allowedBy: ['admin', 'system'],
  },

  // Cancellations
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CANCELLED,
    label: 'Cancel Booking',
    requiresReason: true,
    allowedBy: ['customer', 'admin', 'system'],
  },
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.CANCELLED,
    label: 'Cancel Booking',
    requiresReason: true,
    allowedBy: ['customer', 'admin', 'system'],
    conditions: (booking) => {
      // Can only cancel if more than X hours before appointment
      const now = new Date();
      const bookingTime = new Date(booking.date);
      const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntil >= 24; // 24 hour cancellation policy
    },
  },

  // No show
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.NO_SHOW,
    label: 'Mark as No Show',
    requiresReason: false,
    allowedBy: ['staff', 'admin', 'system'],
  },
  {
    from: BookingStatus.IN_PROGRESS,
    to: BookingStatus.NO_SHOW,
    label: 'Mark as No Show',
    requiresReason: false,
    allowedBy: ['staff', 'admin', 'system'],
  },
];

/**
 * Check if a status transition is allowed
 */
export function isTransitionAllowed(
  currentStatus: BookingStatus,
  newStatus: BookingStatus,
  userRole: 'customer' | 'staff' | 'admin' | 'system',
  booking?: any
): boolean {
  const transition = STATUS_WORKFLOW.find(
    t => (t.from === null || t.from === currentStatus) && t.to === newStatus
  );

  if (!transition) {
    return false;
  }

  if (!transition.allowedBy.includes(userRole)) {
    return false;
  }

  if (transition.conditions && booking) {
    return transition.conditions(booking);
  }

  return true;
}

/**
 * Get available transitions for a booking
 */
export function getAvailableTransitions(
  currentStatus: BookingStatus,
  userRole: 'customer' | 'staff' | 'admin' | 'system',
  booking?: any
): StatusTransition[] {
  return STATUS_WORKFLOW.filter(transition => {
    if (transition.from !== null && transition.from !== currentStatus) {
      return false;
    }

    if (!transition.allowedBy.includes(userRole)) {
      return false;
    }

    if (transition.conditions && booking) {
      return transition.conditions(booking);
    }

    return true;
  });
}

/**
 * Execute a status transition with validation
 */
export async function executeStatusTransition(
  bookingId: number,
  newStatus: BookingStatus,
  userRole: 'customer' | 'staff' | 'admin' | 'system',
  changedBy: string = 'system',
  reason?: string,
  notes?: string
): Promise<any> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      assignedBay: true,
      assignedStaff: true,
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const currentStatus = booking.status;

  // Check if transition is allowed
  if (!isTransitionAllowed(currentStatus, newStatus, userRole, booking)) {
    throw new Error(
      `Status transition from ${currentStatus} to ${newStatus} is not allowed for ${userRole}`
    );
  }

  // Get transition details
  const transition = STATUS_WORKFLOW.find(
    t => (t.from === null || t.from === currentStatus) && t.to === newStatus
  );

  // Check if reason is required
  if (transition?.requiresReason && !reason) {
    throw new Error('Reason is required for this status transition');
  }

  // Execute the transition
  return await updateBookingStatus(bookingId, newStatus, changedBy, reason, notes);
}

/**
 * Get status history for a booking
 */
export async function getBookingStatusHistory(bookingId: number) {
  return await prisma.bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get status workflow configuration
 */
export function getStatusWorkflowConfig() {
  return {
    statuses: Object.values(BookingStatus),
    transitions: STATUS_WORKFLOW.map(t => ({
      from: t.from,
      to: t.to,
      label: t.label,
      requiresReason: t.requiresReason || false,
      allowedBy: t.allowedBy,
    })),
  };
}

/**
 * Validate status workflow for a booking
 */
export async function validateBookingWorkflow(bookingId: number): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      statusHistoryLog: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!booking) {
    return {
      isValid: false,
      errors: ['Booking not found'],
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if all status transitions in history were valid
  for (let i = 0; i < booking.statusHistoryLog.length; i++) {
    const historyEntry = booking.statusHistoryLog[i];
    const previousEntry = i > 0 ? booking.statusHistoryLog[i - 1] : null;

    const fromStatus = previousEntry?.toStatus || null;
    const toStatus = historyEntry.toStatus;

    const transition = STATUS_WORKFLOW.find(
      t => (t.from === null || t.from === fromStatus) && t.to === toStatus
    );

    if (!transition) {
      errors.push(
        `Invalid transition from ${fromStatus || 'none'} to ${toStatus} at ${historyEntry.createdAt}`
      );
    }

    if (transition?.requiresReason && !historyEntry.reason) {
      warnings.push(
        `Missing reason for transition to ${toStatus} at ${historyEntry.createdAt}`
      );
    }
  }

  // Check if current status matches last history entry
  const lastHistoryStatus = booking.statusHistoryLog[booking.statusHistoryLog.length - 1]?.toStatus;
  if (lastHistoryStatus && lastHistoryStatus !== booking.status) {
    warnings.push(
      `Current status (${booking.status}) doesn't match last history entry (${lastHistoryStatus})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'yellow';
    case BookingStatus.CONFIRMED:
      return 'blue';
    case BookingStatus.IN_PROGRESS:
      return 'purple';
    case BookingStatus.COMPLETED:
      return 'green';
    case BookingStatus.CANCELLED:
      return 'red';
    case BookingStatus.NO_SHOW:
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get status label for UI display
 */
export function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'Pending Confirmation';
    case BookingStatus.CONFIRMED:
      return 'Confirmed';
    case BookingStatus.IN_PROGRESS:
      return 'Service in Progress';
    case BookingStatus.COMPLETED:
      return 'Completed';
    case BookingStatus.CANCELLED:
      return 'Cancelled';
    case BookingStatus.NO_SHOW:
      return 'No Show';
    default:
      return status;
  }
}

/**
 * Auto-progress bookings based on time
 * Should be run periodically (e.g., via cron job)
 */
export async function autoProgressBookings() {
  const now = new Date();

  // Find bookings that should be marked as NO_SHOW
  // (confirmed bookings where appointment time has passed by more than 30 minutes)
  const noShowCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const missedBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      date: {
        lte: noShowCutoff,
      },
    },
  });

  for (const booking of missedBookings) {
    try {
      await executeStatusTransition(
        booking.id,
        BookingStatus.NO_SHOW,
        'system',
        'system',
        'Customer did not show up for appointment'
      );
      console.log(`Marked booking ${booking.id} as NO_SHOW`);
    } catch (error) {
      console.error(`Failed to mark booking ${booking.id} as NO_SHOW:`, error);
    }
  }

  return {
    processedBookings: missedBookings.length,
  };
}
