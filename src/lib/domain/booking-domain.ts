/**
 * Booking Domain Logic
 * Enterprise-grade business logic with domain-driven design
 */

import { BookingStatus, PaymentStatus } from '@prisma/client';
import { addMinutes, format, differenceInHours } from 'date-fns';
import { logger } from '../logger';

export interface BookingDomainModel {
  id?: number;
  serviceId: number;
  vehicleType: VehicleType;
  scheduledDateTime: Date;
  duration: number;
  priceCents: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  customer: CustomerInfo;
  confirmationCode?: string;
  metadata: BookingMetadata;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  licensePlate?: string;
  preferences?: CustomerPreferences;
}

export interface CustomerPreferences {
  preferredContactMethod: 'email' | 'sms' | 'push';
  reminderHours: number;
  language: 'fi' | 'en';
  marketingOptIn: boolean;
}

export interface BookingMetadata {
  notes?: string;
  source: 'web' | 'mobile' | 'admin' | 'api';
  createdBy?: string;
  assignedStaffId?: number;
  assignedBayId?: number;
  specialRequests?: string[];
  internalNotes?: string;
}

export interface BusinessRules {
  minimumAdvanceHours: number;
  maximumAdvanceDays: number;
  cancellationDeadlineHours: number;
  allowWeekendBookings: boolean;
  allowHolidayBookings: boolean;
  requirePaymentUpfront: boolean;
  maxBookingsPerCustomerPerDay: number;
  autoConfirmBookings: boolean;
}

export type VehicleType = 'sedan' | 'suv' | 'van' | 'truck' | 'motorcycle';

export interface TimeSlotValidationResult {
  isValid: boolean;
  conflicts: BookingConflict[];
  warnings: string[];
  suggestions: string[];
}

export interface BookingConflict {
  type: 'time_overlap' | 'capacity_exceeded' | 'staff_unavailable' | 'bay_unavailable';
  severity: 'blocking' | 'warning';
  message: string;
  conflictingBookingId?: number;
  resolution?: string;
}

/**
 * Booking Domain Service
 * Core business logic for booking operations
 */
export class BookingDomain {
  private businessRules: BusinessRules;

  constructor(businessRules?: Partial<BusinessRules>) {
    this.businessRules = {
      minimumAdvanceHours: 2,
      maximumAdvanceDays: 30,
      cancellationDeadlineHours: 24,
      allowWeekendBookings: true,
      allowHolidayBookings: false,
      requirePaymentUpfront: true,
      maxBookingsPerCustomerPerDay: 3,
      autoConfirmBookings: false,
      ...businessRules,
    };
  }

  /**
   * Validate booking request against business rules
   */
  validateBookingRequest(
    booking: Partial<BookingDomainModel>,
    existingBookings: BookingDomainModel[] = []
  ): TimeSlotValidationResult {
    const conflicts: BookingConflict[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate required fields
    if (!booking.serviceId || !booking.scheduledDateTime || !booking.customer?.email) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: 'Missing required booking information',
      });
    }

    if (booking.scheduledDateTime) {
      // Check advance booking rules
      const advanceValidation = this.validateAdvanceBooking(booking.scheduledDateTime);
      conflicts.push(...advanceValidation.conflicts);
      warnings.push(...advanceValidation.warnings);

      // Check business hours
      const businessHoursValidation = this.validateBusinessHours(booking.scheduledDateTime);
      conflicts.push(...businessHoursValidation.conflicts);
      warnings.push(...businessHoursValidation.warnings);

      // Check for conflicts with existing bookings
      if (booking.duration) {
        const conflictValidation = this.validateTimeSlotConflicts(
          booking.scheduledDateTime,
          booking.duration,
          existingBookings,
          booking.serviceId!
        );
        conflicts.push(...conflictValidation.conflicts);
      }
    }

    // Validate customer booking limits
    if (booking.customer?.email) {
      const customerLimitValidation = this.validateCustomerLimits(
        booking.customer.email,
        booking.scheduledDateTime!,
        existingBookings
      );
      conflicts.push(...customerLimitValidation.conflicts);
      warnings.push(...customerLimitValidation.warnings);
    }

    // Generate suggestions
    if (conflicts.length > 0) {
      suggestions.push(...this.generateAlternativeSuggestions(booking, existingBookings));
    }

    return {
      isValid: conflicts.filter(c => c.severity === 'blocking').length === 0,
      conflicts,
      warnings,
      suggestions,
    };
  }

  /**
   * Calculate booking pricing with business logic
   */
  calculateBookingPrice(
    basePrice: number,
    vehicleType: VehicleType,
    scheduledDateTime: Date,
    specialRequests: string[] = []
  ): {
    basePriceCents: number;
    vehicleTypeMultiplier: number;
    timeMultiplier: number;
    specialRequestsSurcharge: number;
    totalPriceCents: number;
    breakdown: Array<{ item: string; amount: number; type: 'base' | 'multiplier' | 'surcharge' }>;
  } {
    const breakdown: Array<{ item: string; amount: number; type: 'base' | 'multiplier' | 'surcharge' }> = [];

    // Base price
    let totalCents = basePrice;
    breakdown.push({ item: 'Base Service', amount: basePrice, type: 'base' });

    // Vehicle type multiplier
    const vehicleMultipliers: Record<VehicleType, number> = {
      sedan: 1.0,
      suv: 1.2,
      van: 1.5,
      truck: 1.8,
      motorcycle: 0.8,
    };

    const vehicleMultiplier = vehicleMultipliers[vehicleType];
    if (vehicleMultiplier !== 1.0) {
      const surcharge = Math.round(basePrice * (vehicleMultiplier - 1));
      totalCents += surcharge;
      breakdown.push({
        item: `${vehicleType.toUpperCase()} Vehicle`,
        amount: surcharge,
        type: 'multiplier',
      });
    }

    // Time-based pricing (peak hours, weekends)
    const hour = scheduledDateTime.getHours();
    const isWeekend = scheduledDateTime.getDay() === 0 || scheduledDateTime.getDay() === 6;
    const isPeakHour = hour >= 17 || hour <= 9; // Peak hours: 17:00-21:00, 06:00-09:00

    let timeMultiplier = 1.0;
    if (isWeekend) timeMultiplier += 0.1;
    if (isPeakHour) timeMultiplier += 0.15;

    if (timeMultiplier > 1.0) {
      const surcharge = Math.round(totalCents * (timeMultiplier - 1));
      totalCents += surcharge;

      const timeFactors = [];
      if (isWeekend) timeFactors.push('Weekend');
      if (isPeakHour) timeFactors.push('Peak Hours');

      breakdown.push({
        item: timeFactors.join(' + '),
        amount: surcharge,
        type: 'multiplier',
      });
    }

    // Special requests surcharge
    const specialRequestCharges: Record<string, number> = {
      'interior_cleaning': 1000, // €10
      'wax_treatment': 1500,     // €15
      'engine_cleaning': 2000,   // €20
      'tire_treatment': 500,     // €5
      'express_service': 1000,   // €10
    };

    let specialRequestsTotal = 0;
    for (const request of specialRequests) {
      const charge = specialRequestCharges[request] || 0;
      if (charge > 0) {
        specialRequestsTotal += charge;
        breakdown.push({
          item: request.replace('_', ' ').toUpperCase(),
          amount: charge,
          type: 'surcharge',
        });
      }
    }

    totalCents += specialRequestsTotal;

    return {
      basePriceCents: basePrice,
      vehicleTypeMultiplier: vehicleMultiplier,
      timeMultiplier,
      specialRequestsSurcharge: specialRequestsTotal,
      totalPriceCents: totalCents,
      breakdown,
    };
  }

  /**
   * Determine optimal time slot assignment
   */
  findOptimalTimeSlot(
    preferredDateTime: Date,
    serviceDuration: number,
    availableSlots: Array<{ startTime: Date; capacity: number }>,
    constraints: {
      preferMorning?: boolean;
      preferAfternoon?: boolean;
      avoidPeakHours?: boolean;
      maxWaitMinutes?: number;
    } = {}
  ): {
    recommendedSlot?: Date;
    alternatives: Array<{
      startTime: Date;
      score: number;
      reasons: string[];
    }>;
  } {
    const alternatives: Array<{
      startTime: Date;
      score: number;
      reasons: string[];
    }> = [];

    for (const slot of availableSlots) {
      const score = this.calculateTimeSlotScore(
        slot.startTime,
        preferredDateTime,
        constraints
      );

      alternatives.push({
        startTime: slot.startTime,
        score: score.total,
        reasons: score.factors,
      });
    }

    // Sort by score (higher is better)
    alternatives.sort((a, b) => b.score - a.score);

    const recommendedSlot = alternatives.length > 0 ? alternatives[0].startTime : undefined;

    return {
      recommendedSlot,
      alternatives: alternatives.slice(0, 5), // Top 5 alternatives
    };
  }

  /**
   * Validate booking cancellation
   */
  validateCancellation(
    booking: BookingDomainModel,
    cancellationRequest: {
      reason?: string;
      initiatedBy: 'customer' | 'admin' | 'system';
      refundRequested?: boolean;
    }
  ): {
    allowed: boolean;
    refundEligible: boolean;
    refundAmount?: number;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if booking can be cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      errors.push('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      errors.push('Cannot cancel completed booking');
    }

    // Check cancellation deadline for customer-initiated cancellations
    if (cancellationRequest.initiatedBy === 'customer') {
      const hoursUntilBooking = differenceInHours(
        booking.scheduledDateTime,
        new Date()
      );

      if (hoursUntilBooking < this.businessRules.cancellationDeadlineHours) {
        errors.push(
          `Cancellation deadline passed. Must cancel at least ${this.businessRules.cancellationDeadlineHours} hours in advance.`
        );
      }
    }

    // Determine refund eligibility
    let refundEligible = false;
    let refundAmount = 0;

    if (booking.paymentStatus === PaymentStatus.PAID) {
      const hoursUntilBooking = differenceInHours(
        booking.scheduledDateTime,
        new Date()
      );

      if (hoursUntilBooking >= 48) {
        // Full refund if more than 48 hours
        refundEligible = true;
        refundAmount = booking.priceCents;
      } else if (hoursUntilBooking >= 24) {
        // 50% refund if 24-48 hours
        refundEligible = true;
        refundAmount = Math.round(booking.priceCents * 0.5);
        warnings.push('Only 50% refund available due to cancellation timing');
      } else if (cancellationRequest.initiatedBy === 'admin') {
        // Admin can authorize full refund
        refundEligible = true;
        refundAmount = booking.priceCents;
        warnings.push('Administrative refund authorized');
      }
    }

    return {
      allowed: errors.length === 0,
      refundEligible,
      refundAmount,
      errors,
      warnings,
    };
  }

  /**
   * Generate booking workflow steps
   */
  generateBookingWorkflow(
    booking: BookingDomainModel,
    options: {
      requirePayment?: boolean;
      autoAssignResources?: boolean;
      sendNotifications?: boolean;
    } = {}
  ): Array<{
    step: string;
    description: string;
    required: boolean;
    estimatedDuration: number;
    dependencies: string[];
  }> {
    const workflow = [
      {
        step: 'validate_request',
        description: 'Validate booking request and check availability',
        required: true,
        estimatedDuration: 1000,
        dependencies: [],
      },
      {
        step: 'create_booking_record',
        description: 'Create booking record in database',
        required: true,
        estimatedDuration: 500,
        dependencies: ['validate_request'],
      },
    ];

    if (options.requirePayment) {
      workflow.push({
        step: 'process_payment',
        description: 'Process customer payment',
        required: true,
        estimatedDuration: 5000,
        dependencies: ['create_booking_record'],
      });
    }

    if (options.autoAssignResources) {
      workflow.push({
        step: 'assign_resources',
        description: 'Assign staff and wash bay',
        required: false,
        estimatedDuration: 2000,
        dependencies: options.requirePayment ? ['process_payment'] : ['create_booking_record'],
      });
    }

    if (options.sendNotifications) {
      workflow.push({
        step: 'send_confirmation',
        description: 'Send booking confirmation to customer',
        required: false,
        estimatedDuration: 3000,
        dependencies: options.requirePayment ? ['process_payment'] : ['create_booking_record'],
      });
    }

    workflow.push({
      step: 'update_availability',
      description: 'Update availability cache and time slots',
      required: true,
      estimatedDuration: 1000,
      dependencies: ['create_booking_record'],
    });

    return workflow;
  }

  /**
   * Calculate service capacity utilization
   */
  calculateCapacityUtilization(
    serviceId: number,
    date: Date,
    existingBookings: BookingDomainModel[],
    serviceCapacity: number,
    operatingHours: { start: string; end: string; breakStart?: string; breakEnd?: string }
  ): {
    utilizationPercentage: number;
    peakHours: Array<{ hour: string; utilization: number }>;
    availableSlots: number;
    totalSlots: number;
    recommendations: string[];
  } {
    const dayBookings = existingBookings.filter(booking =>
      booking.serviceId === serviceId &&
      booking.scheduledDateTime.toDateString() === date.toDateString() &&
      booking.status !== BookingStatus.CANCELLED &&
      booking.status !== BookingStatus.NO_SHOW
    );

    // Calculate hourly utilization
    const hourlyUtilization = new Map<string, number>();
    const [startHour] = operatingHours.start.split(':').map(Number);
    const [endHour] = operatingHours.end.split(':').map(Number);

    // Initialize all hours with 0 utilization
    for (let hour = startHour; hour < endHour; hour++) {
      const hourKey = hour.toString().padStart(2, '0') + ':00';
      hourlyUtilization.set(hourKey, 0);
    }

    // Calculate utilization for each booking
    dayBookings.forEach(booking => {
      const startHour = booking.scheduledDateTime.getHours();
      const endHour = addMinutes(booking.scheduledDateTime, booking.duration).getHours();

      for (let hour = startHour; hour <= endHour; hour++) {
        const hourKey = hour.toString().padStart(2, '0') + ':00';
        const current = hourlyUtilization.get(hourKey) || 0;
        hourlyUtilization.set(hourKey, current + (1 / serviceCapacity));
      }
    });

    // Calculate metrics
    const utilizationValues = Array.from(hourlyUtilization.values());
    const averageUtilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length;

    const peakHours = Array.from(hourlyUtilization.entries())
      .filter(([_, utilization]) => utilization > 0.8)
      .map(([hour, utilization]) => ({ hour, utilization }))
      .sort((a, b) => b.utilization - a.utilization);

    const totalSlots = (endHour - startHour) * serviceCapacity * 2; // 30-minute slots
    const bookedSlots = dayBookings.length;
    const availableSlots = totalSlots - bookedSlots;

    // Generate recommendations
    const recommendations = this.generateCapacityRecommendations(
      averageUtilization,
      peakHours,
      availableSlots,
      totalSlots
    );

    return {
      utilizationPercentage: Math.round(averageUtilization * 100),
      peakHours,
      availableSlots,
      totalSlots,
      recommendations,
    };
  }

  /**
   * Determine optimal staff assignment
   */
  determineOptimalStaffAssignment(
    booking: BookingDomainModel,
    availableStaff: Array<{
      id: number;
      name: string;
      specialties: string[];
      currentWorkload: number;
      rating: number;
    }>
  ): {
    recommendedStaffId?: number;
    reasoning: string[];
    alternatives: Array<{
      staffId: number;
      score: number;
      factors: string[];
    }>;
  } {
    const alternatives = availableStaff.map(staff => {
      const score = this.calculateStaffAssignmentScore(booking, staff);
      return {
        staffId: staff.id,
        score: score.total,
        factors: score.factors,
      };
    });

    alternatives.sort((a, b) => b.score - a.score);

    const recommendedStaff = alternatives[0];

    return {
      recommendedStaffId: recommendedStaff?.staffId,
      reasoning: recommendedStaff?.factors || ['No suitable staff available'],
      alternatives: alternatives.slice(0, 3),
    };
  }

  /**
   * Generate booking confirmation details
   */
  generateBookingConfirmation(booking: BookingDomainModel): {
    confirmationCode: string;
    estimatedArrival: Date;
    estimatedCompletion: Date;
    preparationInstructions: string[];
    contactInfo: {
      supportEmail: string;
      supportPhone: string;
      businessHours: string;
    };
    cancellationPolicy: {
      deadline: Date;
      refundPolicy: string;
    };
  } {
    const confirmationCode = booking.confirmationCode || this.generateConfirmationCode();

    // Calculate timing
    const estimatedArrival = new Date(booking.scheduledDateTime);
    estimatedArrival.setMinutes(estimatedArrival.getMinutes() - 5); // Arrive 5 minutes early

    const estimatedCompletion = addMinutes(booking.scheduledDateTime, booking.duration);

    // Generate preparation instructions
    const instructions = this.generatePreparationInstructions(
      booking.vehicleType,
      booking.metadata.specialRequests || []
    );

    // Calculate cancellation deadline
    const cancellationDeadline = new Date(booking.scheduledDateTime);
    cancellationDeadline.setHours(
      cancellationDeadline.getHours() - this.businessRules.cancellationDeadlineHours
    );

    return {
      confirmationCode,
      estimatedArrival,
      estimatedCompletion,
      preparationInstructions: instructions,
      contactInfo: {
        supportEmail: 'info@kiiltoloisto.fi',
        supportPhone: '+358 40 123 4567',
        businessHours: 'Ma-Pe 8:00-18:00, La 9:00-16:00',
      },
      cancellationPolicy: {
        deadline: cancellationDeadline,
        refundPolicy: 'Full refund available up to 48 hours before appointment. 50% refund 24-48 hours before.',
      },
    };
  }

  // Private helper methods

  private validateAdvanceBooking(scheduledDateTime: Date): {
    conflicts: BookingConflict[];
    warnings: string[];
  } {
    const conflicts: BookingConflict[] = [];
    const warnings: string[] = [];
    const now = new Date();

    const hoursInAdvance = differenceInHours(scheduledDateTime, now);

    if (hoursInAdvance < this.businessRules.minimumAdvanceHours) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: `Booking must be made at least ${this.businessRules.minimumAdvanceHours} hours in advance`,
        resolution: 'Choose a later time slot',
      });
    }

    if (hoursInAdvance > this.businessRules.maximumAdvanceDays * 24) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: `Booking cannot be made more than ${this.businessRules.maximumAdvanceDays} days in advance`,
        resolution: 'Choose an earlier date',
      });
    }

    if (hoursInAdvance < 24) {
      warnings.push('Last-minute booking - limited availability for changes');
    }

    return { conflicts, warnings };
  }

  private validateBusinessHours(scheduledDateTime: Date): {
    conflicts: BookingConflict[];
    warnings: string[];
  } {
    const conflicts: BookingConflict[] = [];
    const warnings: string[] = [];

    const dayOfWeek = scheduledDateTime.getDay();
    const hour = scheduledDateTime.getHours();

    // Weekend validation
    if (!this.businessRules.allowWeekendBookings && (dayOfWeek === 0 || dayOfWeek === 6)) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: 'Weekend bookings are not allowed',
        resolution: 'Choose a weekday appointment',
      });
    }

    // Business hours validation (basic - would be enhanced with actual business hours)
    if (hour < 8 || hour >= 18) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: 'Booking time is outside business hours',
        resolution: 'Choose a time between 8:00 and 18:00',
      });
    }

    return { conflicts, warnings };
  }

  private validateTimeSlotConflicts(
    scheduledDateTime: Date,
    duration: number,
    existingBookings: BookingDomainModel[],
    serviceId: number
  ): {
    conflicts: BookingConflict[];
  } {
    const conflicts: BookingConflict[] = [];
    const endDateTime = addMinutes(scheduledDateTime, duration);

    const overlappingBookings = existingBookings.filter(booking => {
      if (booking.serviceId !== serviceId) return false;
      if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.NO_SHOW) {
        return false;
      }

      const bookingEnd = addMinutes(booking.scheduledDateTime, booking.duration);

      return (
        (scheduledDateTime >= booking.scheduledDateTime && scheduledDateTime < bookingEnd) ||
        (endDateTime > booking.scheduledDateTime && endDateTime <= bookingEnd) ||
        (scheduledDateTime <= booking.scheduledDateTime && endDateTime >= bookingEnd)
      );
    });

    if (overlappingBookings.length > 0) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'blocking',
        message: 'Time slot conflicts with existing booking',
        conflictingBookingId: overlappingBookings[0].id,
        resolution: 'Choose a different time slot',
      });
    }

    return { conflicts };
  }

  private validateCustomerLimits(
    customerEmail: string,
    scheduledDateTime: Date,
    existingBookings: BookingDomainModel[]
  ): {
    conflicts: BookingConflict[];
    warnings: string[];
  } {
    const conflicts: BookingConflict[] = [];
    const warnings: string[] = [];

    const sameDay = scheduledDateTime.toDateString();
    const customerBookingsToday = existingBookings.filter(booking =>
      booking.customer.email === customerEmail &&
      booking.scheduledDateTime.toDateString() === sameDay &&
      booking.status !== BookingStatus.CANCELLED &&
      booking.status !== BookingStatus.NO_SHOW
    );

    if (customerBookingsToday.length >= this.businessRules.maxBookingsPerCustomerPerDay) {
      conflicts.push({
        type: 'capacity_exceeded',
        severity: 'blocking',
        message: `Maximum ${this.businessRules.maxBookingsPerCustomerPerDay} bookings per day exceeded`,
        resolution: 'Contact support for additional bookings',
      });
    }

    if (customerBookingsToday.length >= 2) {
      warnings.push('Multiple bookings on same day - confirm this is intentional');
    }

    return { conflicts, warnings };
  }

  private generateAlternativeSuggestions(
    booking: Partial<BookingDomainModel>,
    existingBookings: BookingDomainModel[]
  ): string[] {
    const suggestions: string[] = [];

    if (booking.scheduledDateTime) {
      // Suggest nearby time slots
      const nextDay = new Date(booking.scheduledDateTime);
      nextDay.setDate(nextDay.getDate() + 1);

      suggestions.push(`Try ${format(nextDay, 'yyyy-MM-dd')} at the same time`);

      // Suggest different times on same day
      const earlierTime = new Date(booking.scheduledDateTime);
      earlierTime.setHours(earlierTime.getHours() - 2);

      const laterTime = new Date(booking.scheduledDateTime);
      laterTime.setHours(laterTime.getHours() + 2);

      suggestions.push(`Try ${format(earlierTime, 'HH:mm')} or ${format(laterTime, 'HH:mm')} on the same day`);

      // Service-specific suggestions
      if (booking.vehicleType === 'truck' || booking.vehicleType === 'van') {
        suggestions.push('Consider early morning slots (8:00-10:00) for larger vehicles');
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  private calculateTimeSlotScore(
    slotTime: Date,
    preferredTime: Date,
    constraints: any
  ): {
    total: number;
    factors: string[];
  } {
    let score = 100;
    const factors: string[] = [];

    // Time proximity score
    const hoursDiff = Math.abs(differenceInHours(slotTime, preferredTime));
    const proximityScore = Math.max(0, 50 - hoursDiff * 5);
    score += proximityScore;

    if (hoursDiff === 0) {
      factors.push('Exact preferred time');
    } else if (hoursDiff <= 2) {
      factors.push('Close to preferred time');
    }

    // Time preference scores
    const hour = slotTime.getHours();

    if (constraints.preferMorning && hour >= 8 && hour < 12) {
      score += 20;
      factors.push('Morning slot (preferred)');
    }

    if (constraints.preferAfternoon && hour >= 12 && hour < 17) {
      score += 20;
      factors.push('Afternoon slot (preferred)');
    }

    if (constraints.avoidPeakHours && (hour < 9 || hour > 17)) {
      score -= 10;
      factors.push('Off-peak hours');
    }

    return { total: score, factors };
  }

  private calculateStaffAssignmentScore(
    booking: BookingDomainModel,
    staff: any
  ): {
    total: number;
    factors: string[];
  } {
    let score = 50;
    const factors: string[] = [];

    // Rating score
    score += staff.rating * 10;
    factors.push(`Rating: ${staff.rating}/5`);

    // Workload score (prefer less busy staff)
    score -= staff.currentWorkload * 5;
    if (staff.currentWorkload === 0) {
      factors.push('Available - no current workload');
    } else if (staff.currentWorkload < 3) {
      factors.push('Light workload');
    }

    // Specialty matching
    const vehicleSpecialty = `${booking.vehicleType}_specialist`;
    if (staff.specialties.includes(vehicleSpecialty)) {
      score += 30;
      factors.push(`${booking.vehicleType} specialist`);
    }

    return { total: score, factors };
  }

  private generatePreparationInstructions(
    vehicleType: VehicleType,
    specialRequests: string[]
  ): string[] {
    const instructions = [
      'Remove all personal items from your vehicle',
      'Ensure fuel cap and windows are properly closed',
    ];

    // Vehicle-specific instructions
    switch (vehicleType) {
      case 'truck':
      case 'van':
        instructions.push('Please arrive 10 minutes early for larger vehicle processing');
        break;
      case 'motorcycle':
        instructions.push('Remove any loose accessories or bags');
        break;
    }

    // Special request instructions
    if (specialRequests.includes('interior_cleaning')) {
      instructions.push('Remove floor mats and personal items from interior');
    }

    if (specialRequests.includes('engine_cleaning')) {
      instructions.push('Ensure engine is cool before service');
    }

    return instructions;
  }

  private generateCapacityRecommendations(
    avgUtilization: number,
    peakHours: Array<{ hour: string; utilization: number }>,
    availableSlots: number,
    totalSlots: number
  ): string[] {
    const recommendations: string[] = [];

    if (avgUtilization > 0.9) {
      recommendations.push('Consider increasing service capacity or extending hours');
    } else if (avgUtilization < 0.3) {
      recommendations.push('Low utilization - consider promotional pricing');
    }

    if (peakHours.length > 3) {
      recommendations.push('Multiple peak hours identified - consider dynamic pricing');
    }

    if (availableSlots < totalSlots * 0.1) {
      recommendations.push('Very limited availability - encourage off-peak bookings');
    }

    return recommendations;
  }

  private generateConfirmationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Update business rules
   */
  updateBusinessRules(newRules: Partial<BusinessRules>): void {
    this.businessRules = { ...this.businessRules, ...newRules };

    logger.audit('business_rules_updated', 'booking_domain', undefined, {
      updatedRules: Object.keys(newRules),
      newValues: newRules,
    });
  }

  /**
   * Get current business rules
   */
  getBusinessRules(): BusinessRules {
    return { ...this.businessRules };
  }
}

// Export singleton instance
export const bookingDomain = new BookingDomain();