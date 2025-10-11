/**
 * Booking Domain Errors
 * Specialized error classes for booking-related business logic
 */

import { BusinessError, ValidationError, type ErrorContext } from './base-error';

/**
 * Service-related errors
 */
export class ServiceNotFoundError extends BusinessError {
  constructor(serviceId: number, context: ErrorContext = {}) {
    super(
      `Service with ID ${serviceId} not found or inactive`,
      'SERVICE_NOT_FOUND',
      { ...context, serviceId },
      { statusCode: 404 }
    );
  }

  getUserMessage(): string {
    return 'The requested service is not available.';
  }
}

export class ServiceInactiveError extends BusinessError {
  constructor(serviceId: number, context: ErrorContext = {}) {
    super(
      `Service with ID ${serviceId} is currently inactive`,
      'SERVICE_INACTIVE',
      { ...context, serviceId },
      { statusCode: 400 }
    );
  }

  getUserMessage(): string {
    return 'This service is currently unavailable.';
  }
}

/**
 * Availability and scheduling errors
 */
export class TimeSlotUnavailableError extends BusinessError {
  constructor(
    date: Date,
    startTime: string,
    serviceId: number,
    context: ErrorContext = {}
  ) {
    super(
      `Time slot ${startTime} on ${date.toISOString().split('T')[0]} is not available for service ${serviceId}`,
      'TIME_SLOT_UNAVAILABLE',
      { ...context, date: date.toISOString().split('T')[0], startTime, serviceId }
    );
  }

  getUserMessage(): string {
    return 'The selected time slot is no longer available. Please choose a different time.';
  }
}

export class BookingOutsideBusinessHoursError extends BusinessError {
  constructor(
    date: Date,
    startTime: string,
    businessHours: { startTime: string; endTime: string },
    context: ErrorContext = {}
  ) {
    super(
      `Booking time ${startTime} on ${date.toISOString().split('T')[0]} is outside business hours (${businessHours.startTime} - ${businessHours.endTime})`,
      'OUTSIDE_BUSINESS_HOURS',
      { ...context, date: date.toISOString().split('T')[0], startTime, businessHours }
    );
  }

  getUserMessage(): string {
    return 'The selected time is outside our business hours. Please choose a time during our operating hours.';
  }
}

export class HolidayBookingError extends BusinessError {
  constructor(
    date: Date,
    holidayName: string,
    context: ErrorContext = {}
  ) {
    super(
      `Cannot book on ${date.toISOString().split('T')[0]} due to holiday: ${holidayName}`,
      'HOLIDAY_BOOKING_NOT_ALLOWED',
      { ...context, date: date.toISOString().split('T')[0], holidayName }
    );
  }

  getUserMessage(): string {
    return 'Bookings are not available on this date due to a holiday. Please choose a different date.';
  }
}

export class AdvanceBookingLimitError extends BusinessError {
  constructor(
    requestedDate: Date,
    maxAdvanceDays: number,
    context: ErrorContext = {}
  ) {
    super(
      `Cannot book more than ${maxAdvanceDays} days in advance. Requested date: ${requestedDate.toISOString().split('T')[0]}`,
      'ADVANCE_BOOKING_LIMIT_EXCEEDED',
      { ...context, requestedDate: requestedDate.toISOString().split('T')[0], maxAdvanceDays }
    );
  }

  getUserMessage(): string {
    return `Bookings can only be made up to ${this.context.maxAdvanceDays} days in advance.`;
  }
}

export class LeadTimeViolationError extends BusinessError {
  constructor(
    requestedDateTime: Date,
    minimumLeadTimeHours: number,
    context: ErrorContext = {}
  ) {
    super(
      `Booking must be made at least ${minimumLeadTimeHours} hours in advance. Requested time: ${requestedDateTime.toISOString()}`,
      'INSUFFICIENT_LEAD_TIME',
      { ...context, requestedDateTime: requestedDateTime.toISOString(), minimumLeadTimeHours }
    );
  }

  getUserMessage(): string {
    return `Bookings must be made at least ${this.context.minimumLeadTimeHours} hours in advance.`;
  }
}

/**
 * Booking lifecycle errors
 */
export class BookingNotFoundError extends BusinessError {
  constructor(identifier: string | number, context: ErrorContext = {}) {
    super(
      `Booking not found: ${identifier}`,
      'BOOKING_NOT_FOUND',
      { ...context, identifier },
      { statusCode: 404 }
    );
  }

  getUserMessage(): string {
    return 'The booking was not found. Please check your confirmation code.';
  }
}

export class InvalidBookingStatusTransitionError extends BusinessError {
  constructor(
    bookingId: number,
    fromStatus: string,
    toStatus: string,
    context: ErrorContext = {}
  ) {
    super(
      `Invalid status transition for booking ${bookingId}: ${fromStatus} -> ${toStatus}`,
      'INVALID_STATUS_TRANSITION',
      { ...context, bookingId, fromStatus, toStatus }
    );
  }

  getUserMessage(): string {
    return 'This booking cannot be changed to the requested status.';
  }
}

export class BookingAlreadyCancelledError extends BusinessError {
  constructor(bookingId: number, context: ErrorContext = {}) {
    super(
      `Booking ${bookingId} is already cancelled`,
      'BOOKING_ALREADY_CANCELLED',
      { ...context, bookingId }
    );
  }

  getUserMessage(): string {
    return 'This booking has already been cancelled.';
  }
}

export class BookingAlreadyCompletedError extends BusinessError {
  constructor(bookingId: number, context: ErrorContext = {}) {
    super(
      `Booking ${bookingId} is already completed`,
      'BOOKING_ALREADY_COMPLETED',
      { ...context, bookingId }
    );
  }

  getUserMessage(): string {
    return 'This booking has already been completed.';
  }
}

export class CancellationDeadlinePassedError extends BusinessError {
  constructor(
    bookingId: number,
    deadlineHours: number,
    hoursUntilBooking: number,
    context: ErrorContext = {}
  ) {
    super(
      `Cancellation deadline passed for booking ${bookingId}. Must cancel at least ${deadlineHours} hours in advance (${hoursUntilBooking} hours remaining)`,
      'CANCELLATION_DEADLINE_PASSED',
      { ...context, bookingId, deadlineHours, hoursUntilBooking }
    );
  }

  getUserMessage(): string {
    return `Cancellations must be made at least ${this.context.deadlineHours} hours in advance.`;
  }
}

/**
 * Payment-related errors
 */
export class PaymentRequiredError extends BusinessError {
  constructor(bookingId: number, amount: number, context: ErrorContext = {}) {
    super(
      `Payment required for booking ${bookingId}. Amount: ${amount / 100} EUR`,
      'PAYMENT_REQUIRED',
      { ...context, bookingId, amount }
    );
  }

  getUserMessage(): string {
    return 'Payment is required to confirm this booking.';
  }
}

export class PaymentFailedError extends BusinessError {
  constructor(
    bookingId: number,
    paymentIntentId?: string,
    reason?: string,
    context: ErrorContext = {}
  ) {
    super(
      `Payment failed for booking ${bookingId}${paymentIntentId ? ` (Payment ID: ${paymentIntentId})` : ''}${reason ? `: ${reason}` : ''}`,
      'PAYMENT_FAILED',
      { ...context, bookingId, paymentIntentId, reason },
      { statusCode: 402 }
    );
  }

  getUserMessage(): string {
    return 'Payment failed. Please check your payment details and try again.';
  }
}

export class RefundNotAllowedError extends BusinessError {
  constructor(
    bookingId: number,
    paymentStatus: string,
    context: ErrorContext = {}
  ) {
    super(
      `Refund not allowed for booking ${bookingId} with payment status: ${paymentStatus}`,
      'REFUND_NOT_ALLOWED',
      { ...context, bookingId, paymentStatus }
    );
  }

  getUserMessage(): string {
    return 'A refund cannot be processed for this booking.';
  }
}

/**
 * Customer validation errors
 */
export class InvalidCustomerDataError extends ValidationError {
  constructor(errors: Array<{ field: string; message: string; value?: any }>) {
    super(
      'Invalid customer data provided',
      errors,
      { errorType: 'customer_validation' }
    );
  }

  getUserMessage(): string {
    return 'Please check your information and correct any errors.';
  }
}

export class InvalidVehicleTypeError extends BusinessError {
  constructor(vehicleType: string, allowedTypes: string[], context: ErrorContext = {}) {
    super(
      `Invalid vehicle type: ${vehicleType}. Allowed types: ${allowedTypes.join(', ')}`,
      'INVALID_VEHICLE_TYPE',
      { ...context, vehicleType, allowedTypes }
    );
  }

  getUserMessage(): string {
    return `Invalid vehicle type. Please select from: ${this.context.allowedTypes?.join(', ')}.`;
  }
}

export class InvalidLicensePlateError extends ValidationError {
  constructor(licensePlate: string, context: ErrorContext = {}) {
    super(
      'Invalid license plate format',
      [{ field: 'licensePlate', message: 'Invalid format', value: licensePlate }],
      { ...context, licensePlate }
    );
  }

  getUserMessage(): string {
    return 'Please enter a valid license plate number.';
  }
}

/**
 * Capacity and resource errors
 */
export class CapacityExceededError extends BusinessError {
  constructor(
    serviceId: number,
    requestedCapacity: number,
    availableCapacity: number,
    context: ErrorContext = {}
  ) {
    super(
      `Capacity exceeded for service ${serviceId}. Requested: ${requestedCapacity}, Available: ${availableCapacity}`,
      'CAPACITY_EXCEEDED',
      { ...context, serviceId, requestedCapacity, availableCapacity }
    );
  }

  getUserMessage(): string {
    return `Only ${this.context.availableCapacity} slot(s) available for this time.`;
  }
}

export class NoWashBayAvailableError extends BusinessError {
  constructor(serviceId: number, date: string, time: string, context: ErrorContext = {}) {
    super(
      `No wash bay available for service ${serviceId} on ${date} at ${time}`,
      'NO_WASH_BAY_AVAILABLE',
      { ...context, serviceId, date, time }
    );
  }

  getUserMessage(): string {
    return 'No wash bay is available for the selected time. Please choose a different time.';
  }
}

/**
 * Staff assignment errors
 */
export class NoStaffAvailableError extends BusinessError {
  constructor(serviceId: number, date: string, time: string, context: ErrorContext = {}) {
    super(
      `No staff available for service ${serviceId} on ${date} at ${time}`,
      'NO_STAFF_AVAILABLE',
      { ...context, serviceId, date, time }
    );
  }

  getUserMessage(): string {
    return 'No staff is available for the selected time. Please choose a different time.';
  }
}

export class InvalidStaffAssignmentError extends BusinessError {
  constructor(
    staffId: number,
    bookingId: number,
    reason: string,
    context: ErrorContext = {}
  ) {
    super(
      `Cannot assign staff ${staffId} to booking ${bookingId}: ${reason}`,
      'INVALID_STAFF_ASSIGNMENT',
      { ...context, staffId, bookingId, reason }
    );
  }

  getUserMessage(): string {
    return 'The selected staff member cannot be assigned to this booking.';
  }
}

/**
 * System and operational errors
 */
export class BookingSystemMaintenanceError extends BusinessError {
  constructor(maintenanceWindow?: { start: Date; end: Date }, context: ErrorContext = {}) {
    super(
      'Booking system is temporarily unavailable for maintenance',
      'SYSTEM_MAINTENANCE',
      { ...context, maintenanceWindow },
      { statusCode: 503, retryable: true }
    );
  }

  getUserMessage(): string {
    const maintenanceWindow = this.context.maintenanceWindow;
    if (maintenanceWindow) {
      return `The booking system is temporarily unavailable for maintenance until ${maintenanceWindow.end.toLocaleString()}.`;
    }
    return 'The booking system is temporarily unavailable for maintenance. Please try again later.';
  }
}

export class ConcurrentBookingError extends BusinessError {
  constructor(
    date: string,
    time: string,
    serviceId: number,
    context: ErrorContext = {}
  ) {
    super(
      `Concurrent booking attempt detected for ${date} ${time} service ${serviceId}`,
      'CONCURRENT_BOOKING_ATTEMPT',
      { ...context, date, time, serviceId },
      { retryable: true }
    );
  }

  getUserMessage(): string {
    return 'This time slot was just booked by another customer. Please select a different time.';
  }
}

/**
 * Notification errors
 */
export class NotificationDeliveryError extends BusinessError {
  constructor(
    type: string,
    recipient: string,
    bookingId: number,
    context: ErrorContext = {}
  ) {
    super(
      `Failed to deliver ${type} notification to ${recipient} for booking ${bookingId}`,
      'NOTIFICATION_DELIVERY_FAILED',
      { ...context, type, recipient, bookingId },
      { severity: 'low', retryable: true }
    );
  }

  getUserMessage(): string {
    return 'We were unable to send a confirmation notification. Your booking is still confirmed.';
  }
}

/**
 * Helper function to create booking errors from common scenarios
 */
export function createBookingError(scenario: string, data: any): BusinessError {
  switch (scenario) {
    case 'service_not_found':
      return new ServiceNotFoundError(data.serviceId, data.context);

    case 'time_slot_unavailable':
      return new TimeSlotUnavailableError(data.date, data.startTime, data.serviceId, data.context);

    case 'booking_not_found':
      return new BookingNotFoundError(data.identifier, data.context);

    case 'payment_failed':
      return new PaymentFailedError(data.bookingId, data.paymentIntentId, data.reason, data.context);

    case 'cancellation_deadline_passed':
      return new CancellationDeadlinePassedError(
        data.bookingId,
        data.deadlineHours,
        data.hoursUntilBooking,
        data.context
      );

    default:
      return new BusinessError(
        data.message || 'An unknown booking error occurred',
        'UNKNOWN_BOOKING_ERROR',
        data.context
      );
  }
}