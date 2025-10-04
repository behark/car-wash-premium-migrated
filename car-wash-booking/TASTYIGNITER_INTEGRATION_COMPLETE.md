# TastyIgniter Booking System Integration - Complete Documentation

## Overview

This document details the comprehensive integration of TastyIgniter's advanced reservation system features into the Kiilto & Loisto car wash booking platform. The integration maintains our Next.js/TypeScript/Prisma architecture while adopting enterprise-grade booking management capabilities.

## 🎯 What Was Integrated from TastyIgniter

### 1. Database Schema Enhancements

#### New Models

**WashBay Model** (inspired by DiningTable)
- Multi-bay management system
- Capacity-based filtering (small/medium/large vehicles)
- Enable/disable individual bays
- Physical location tracking
- Bay number assignment

**Staff Model**
- Staff management with roles (Operator, Supervisor, Manager, Admin)
- Active/inactive status
- Specialties tracking
- Assignment to bookings

**BookingStatusHistory Model**
- Complete audit trail of all status changes
- Track who made changes (customer/staff/admin/system)
- Reason and notes for each change
- Metadata storage for additional context

**BookingConfiguration Model**
- Centralized configuration management
- Time slot intervals (15min, 30min, 60min)
- Lead time requirements (minimum hours in advance)
- Cancellation deadlines
- Auto-confirmation settings
- Bay assignment preferences

**AutomationRule & AutomationExecution Models**
- Event-driven automation system
- Condition-based rule execution
- Action chains (email + SMS + push)
- Execution history and logging

#### Enhanced Booking Model

Added TastyIgniter-inspired fields:
- `assignedStaffId` - Staff assignment
- `assignedBayId` - Wash bay assignment
- `assignedAt` - Assignment timestamp
- `assignedBy` - Who assigned (system/admin)
- `cancellationReason` - Why booking was cancelled
- `guestCount` - Number of people (for future features)
- `statusHistory` - JSON array of status changes

### 2. Enhanced Booking Manager (src/lib/booking-manager.ts)

Inspired by TastyIgniter's `BookingManager` class:

#### Time Slot Generation (`makeTimeSlots`)
```typescript
await makeTimeSlots(date, serviceId, config)
```
- Respects business hours and break periods
- Applies lead time (minimum advance booking)
- Filters out holidays automatically
- Calculates capacity per slot (multi-bay support)
- Shows remaining capacity to customers
- Configurable intervals (15/30/60 minutes)

#### Smart Bay Assignment (`getNextBookableBay`)
```typescript
await getNextBookableBay(date, startTime, duration, vehicleSize)
```
- Finds best available bay for vehicle size
- Checks capacity constraints (min/max vehicle size)
- Considers bay availability windows
- Returns null if no bays available

#### Auto Bay Assignment (`autoAssignBay`)
```typescript
await autoAssignBay(bookingId)
```
- Automatically assigns optimal bay
- Triggered on booking creation (if enabled)
- Vehicle size-based matching
- Updates assignment timestamps

#### Enhanced Booking Creation (`saveReservation`)
```typescript
await saveReservation(bookingData)
```
- Configuration-aware booking creation
- Auto-confirmation if enabled
- Automatic bay assignment
- Status history initialization
- Event emission for automation triggers

#### Cancellation Management

**isCancelable**
```typescript
await isCancelable(bookingId)
```
- Time-based cancellation rules
- Configuration-driven deadlines
- Status validation

**markAsCanceled**
```typescript
await markAsCanceled(bookingId, reason, canceledBy)
```
- Reason tracking
- Status history logging
- Event emission
- Refund automation trigger

#### Status Management
```typescript
await updateBookingStatus(bookingId, newStatus, changedBy, reason, notes)
```
- Complete status history
- Event-driven notifications
- Workflow validation

### 3. Status Workflow System (src/lib/status-workflow.ts)

Inspired by TastyIgniter's status workflow configuration:

#### Workflow Definition
```typescript
const STATUS_WORKFLOW: StatusTransition[]
```

**Defined Transitions:**
1. `null → PENDING` - Initial booking creation
2. `PENDING → CONFIRMED` - Admin/system confirmation
3. `CONFIRMED → IN_PROGRESS` - Service starts
4. `IN_PROGRESS → COMPLETED` - Service completes
5. `CONFIRMED → COMPLETED` - Quick completion (admin only)
6. `PENDING → CANCELLED` - Early cancellation
7. `CONFIRMED → CANCELLED` - Cancellation with time restriction
8. `CONFIRMED → NO_SHOW` - Customer didn't arrive
9. `IN_PROGRESS → NO_SHOW` - Customer left mid-service

#### Transition Validation
```typescript
isTransitionAllowed(currentStatus, newStatus, userRole, booking)
```
- Role-based permissions (customer/staff/admin/system)
- Conditional transitions (e.g., 24-hour cancellation policy)
- Reason requirements

#### Status Transition Execution
```typescript
await executeStatusTransition(bookingId, newStatus, userRole, changedBy, reason, notes)
```
- Validates transition permissions
- Checks conditional rules
- Enforces reason requirements
- Creates history entries
- Triggers automation events

#### Workflow Utilities
- `getAvailableTransitions()` - Show valid next states
- `getBookingStatusHistory()` - Full audit trail
- `validateBookingWorkflow()` - Check workflow integrity
- `autoProgressBookings()` - Automatic NO_SHOW marking

### 4. Automation Engine (src/lib/automation-engine.ts)

Inspired by TastyIgniter's automation system:

#### Event-Driven Architecture
```typescript
enum AutomationEvent {
  BOOKING_CREATED,
  BOOKING_CONFIRMED,
  BOOKING_STATUS_CHANGED,
  BOOKING_ASSIGNED,
  BOOKING_CANCELLED,
  BOOKING_COMPLETED,
  BOOKING_NO_SHOW,
  PAYMENT_RECEIVED,
  REMINDER_24H,
  REMINDER_2H,
}
```

#### Automation Rule Creation
```typescript
await createAutomationRule({
  name: "Send Booking Confirmation",
  eventType: AutomationEvent.BOOKING_CREATED,
  conditions: [...],
  actions: [...],
  priority: 10
})
```

#### Supported Actions
1. **Email** - Send templated emails
2. **SMS** - Send text messages
3. **Push** - Push notifications
4. **Webhook** - HTTP POST to external systems
5. **Status Change** - Automatic status progression

#### Condition System
```typescript
interface AutomationCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}
```

Example:
```javascript
{
  field: "booking.priceCents",
  operator: "greaterThan",
  value: 5000
}
```

#### Template System
Placeholder replacement in messages:
- `{customerName}` - Customer's name
- `{confirmationCode}` - Booking confirmation code
- `{date}` - Booking date
- `{startTime}` / `{endTime}` - Booking time
- `{serviceName}` - Service name
- `{price}` - Service price
- `{status}` - Current status
- `{vehicleType}` - Vehicle type
- `{licensePlate}` - License plate

#### Default Automation Rules

**Rule 1: Booking Confirmation Email**
- Event: `BOOKING_CREATED`
- Action: Send confirmation email
- Priority: 10

**Rule 2: 24-Hour Reminder**
- Event: `REMINDER_24H`
- Actions: Send email + SMS
- Priority: 5

**Rule 3: Cancellation Confirmation**
- Event: `BOOKING_CANCELLED`
- Action: Send cancellation email
- Priority: 8

**Rule 4: Completion Thank You**
- Event: `BOOKING_COMPLETED`
- Action: Send thank you email
- Priority: 5

#### Automation Execution Logging
```typescript
model AutomationExecution {
  ruleId
  bookingId
  status  // "success", "failed", "skipped"
  result
  errorMessage
  executedAt
}
```

### 5. Configuration Management

#### Booking Configuration Keys
```typescript
{
  intervalMinutes: 30,              // Time slot intervals
  leadTimeHours: 2,                 // Min hours in advance
  maxAdvanceDays: 30,               // Max days ahead to book
  cancellationDeadlineHours: 24,    // Cancellation deadline
  allowCustomerCancellation: true,  // Allow customer cancels
  enableAutoBayAssignment: true,    // Auto-assign bays
  autoConfirmBookings: false,       // Auto-confirm bookings
  requirePaymentUpfront: true,      // Require payment first
  sendReminderHours: 24,            // When to send reminders
  enableSmsNotifications: true,     // Enable SMS
  enablePushNotifications: true     // Enable push
}
```

## 📊 Feature Comparison

| Feature | Before | After (TastyIgniter-Inspired) |
|---------|--------|-------------------------------|
| Time Slot Generation | Basic hourly slots | Dynamic intervals, lead time, capacity-aware |
| Resource Management | Single service at a time | Multi-bay with capacity management |
| Staff Assignment | None | Full staff management and assignment |
| Status Workflow | Simple status field | Role-based workflow with validation |
| Status History | None | Complete audit trail with reasons |
| Cancellation | Simple cancellation | Time-based rules, reason tracking |
| Automation | Manual emails | Event-driven automation engine |
| Notifications | Basic email | Email + SMS + Push with templates |
| Capacity Management | Boolean availability | Numeric capacity with remaining slots |
| Configuration | Hardcoded | Database-driven configuration |

## 🔄 Event Flow

### Booking Creation Flow
```
1. Customer submits booking
   ↓
2. saveReservation() called
   ↓
3. Validation (time slot, conflicts)
   ↓
4. Create booking record
   ↓
5. Auto-assign bay (if enabled)
   ↓
6. Create status history entry
   ↓
7. Emit "booking.created" event
   ↓
8. Automation engine executes rules
   ↓
9. Send confirmation email/SMS
```

### Status Change Flow
```
1. Status transition requested
   ↓
2. Validate transition permissions
   ↓
3. Check conditional rules
   ↓
4. Update booking status
   ↓
5. Create status history entry
   ↓
6. Emit "booking.statusChanged" event
   ↓
7. Automation engine executes rules
   ↓
8. Send status update notifications
```

### Bay Assignment Flow
```
1. autoAssignBay() called
   ↓
2. Determine vehicle size from type
   ↓
3. Query available bays with capacity match
   ↓
4. Check bay availability for time slot
   ↓
5. Assign first available bay
   ↓
6. Update booking with bay assignment
   ↓
7. Emit "booking.assigned" event
   ↓
8. Send assignment notification to staff
```

## 🚀 API Enhancements Needed

### New Endpoints to Create

1. **GET /api/bookings/availability-extended**
   - Return capacity per slot
   - Include bay information
   - Show pricing variations

2. **PATCH /api/bookings/:id/status**
   - Update status with workflow validation
   - Require reason for certain transitions
   - Log to status history

3. **POST /api/bookings/:id/assign-bay**
   - Manual bay assignment
   - Staff assignment
   - Override auto-assignment

4. **POST /api/bookings/:id/cancel**
   - Validate cancellation rules
   - Require cancellation reason
   - Trigger refund automation

5. **GET /api/bookings/:id/history**
   - Complete status history
   - Timeline view data

6. **GET /api/admin/dashboard/stats**
   - Daily booking statistics
   - Bay utilization metrics
   - Revenue tracking

7. **POST /api/automation/rules**
   - Create automation rules
   - Update existing rules

8. **GET /api/admin/bays**
   - List wash bays
   - Availability overview

## 🎨 UI Components Needed

### Customer-Facing
1. **Enhanced Booking Form**
   - Show remaining capacity per slot
   - Display bay information (optional)
   - Real-time availability updates

2. **Booking Details Page**
   - Status timeline
   - Bay assignment info
   - Staff information

3. **Cancellation Dialog**
   - Reason selection
   - Cancellation policy display
   - Deadline warning

### Admin Dashboard
1. **Calendar View**
   - Daily/weekly booking calendar
   - Color-coded by status
   - Drag-and-drop bay assignment

2. **Status Management**
   - Quick status transitions
   - Status change dialog with reason
   - Visual workflow diagram

3. **Bay Management**
   - Enable/disable bays
   - Capacity configuration
   - Utilization metrics

4. **Automation Rules Manager**
   - Create/edit automation rules
   - Test rules
   - View execution logs

5. **Staff Management**
   - Add/edit staff members
   - Role assignment
   - Availability scheduling

6. **Reports & Analytics**
   - Booking trends
   - Bay utilization
   - Revenue reports
   - Customer retention

## 📝 Migration Steps

### 1. Database Migration
```bash
# Generate migration
npx prisma migrate dev --name tastyigniter_integration

# Apply to production
npx prisma migrate deploy
```

### 2. Seed Initial Data
```typescript
// Create default wash bays
await prisma.washBay.createMany({
  data: [
    { name: "Bay 1", bayNumber: 1, minCapacity: 1, maxCapacity: 3 },
    { name: "Bay 2", bayNumber: 2, minCapacity: 1, maxCapacity: 3 },
    { name: "Bay 3", bayNumber: 3, minCapacity: 2, maxCapacity: 3 },
  ]
});

// Create default configuration
await prisma.bookingConfiguration.create({
  data: {
    key: "default",
    intervalMinutes: 30,
    leadTimeHours: 2,
    // ... other config
  }
});

// Setup automation rules
await setupDefaultAutomationRules();
```

### 3. Initialize Automation Engine
```typescript
// In your server initialization
import { initializeAutomationEngine } from './lib/automation-engine';

initializeAutomationEngine();
```

### 4. Update Existing Bookings
```typescript
// Add status history for existing bookings
const existingBookings = await prisma.booking.findMany({
  where: { statusHistory: null }
});

for (const booking of existingBookings) {
  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      toStatus: booking.status,
      changedBy: 'system',
      changedByType: 'system',
      reason: 'Historical booking migration'
    }
  });
}
```

## 🔧 Configuration Examples

### Example 1: High-Volume Car Wash
```javascript
{
  intervalMinutes: 15,  // Quick turnover
  leadTimeHours: 1,     // Book 1 hour ahead
  maxAdvanceDays: 14,   // 2 weeks advance booking
  cancellationDeadlineHours: 4,  // 4-hour cancellation
  enableAutoBayAssignment: true,
  autoConfirmBookings: true  // Instant confirmation
}
```

### Example 2: Premium Detailing Service
```javascript
{
  intervalMinutes: 60,  // Longer slots
  leadTimeHours: 24,    // Book 1 day ahead
  maxAdvanceDays: 60,   // 2 months advance
  cancellationDeadlineHours: 48,  // 2-day cancellation
  enableAutoBayAssignment: true,
  autoConfirmBookings: false  // Manual confirmation
}
```

## 📈 Benefits Achieved

1. **Scalability**
   - Multi-bay concurrent operations
   - Staff workload distribution
   - Automated bay assignment

2. **Customer Experience**
   - Real-time capacity visibility
   - Flexible cancellation policies
   - Automated reminders

3. **Operational Efficiency**
   - Automated workflows
   - Staff assignment optimization
   - Reduced no-shows

4. **Business Intelligence**
   - Complete audit trails
   - Utilization metrics
   - Revenue tracking

5. **Flexibility**
   - Configuration-driven behavior
   - Custom automation rules
   - Role-based permissions

## 🔐 Security Considerations

1. **Role-Based Access Control**
   - Customer: Book, view own bookings, cancel (with restrictions)
   - Staff: Update status, assign bays, view all bookings
   - Admin: Full access, configure system

2. **Audit Trail**
   - All status changes logged
   - Who, what, when, why
   - Cannot be deleted (only soft delete)

3. **Validation**
   - Status transition validation
   - Time-based rules enforcement
   - Capacity overflow prevention

## 🎯 Next Steps

1. **Create Enhanced API Endpoints** (Priority: High)
2. **Build Admin Dashboard UI** (Priority: High)
3. **Add Customer Portal Features** (Priority: Medium)
4. **Implement Reminder Scheduler** (Priority: Medium)
5. **Add Bay Floor Plan Visualization** (Priority: Low)
6. **Create Mobile App Integration** (Priority: Low)

## 📚 Code Examples

### Creating a Booking with the New System
```typescript
import { saveReservation } from './lib/booking-manager';

const booking = await saveReservation({
  serviceId: 1,
  vehicleType: "Henkilöauto (keskikokoinen)",
  date: new Date('2025-10-05'),
  startTime: "14:00",
  customerName: "Matti Meikäläinen",
  customerEmail: "matti@example.com",
  customerPhone: "+358401234567",
  licensePlate: "ABC-123",
  notes: "Extra dirty wheels",
  guestCount: 1
});

// Booking is automatically:
// - Validated for conflicts
// - Assigned to a bay (if enabled)
// - Added to status history
// - Triggers automation (confirmation email)
```

### Creating an Automation Rule
```typescript
import { createAutomationRule } from './lib/automation-engine';

await createAutomationRule({
  name: "VIP Customer Special Treatment",
  description: "Send SMS to VIP customers immediately",
  eventType: AutomationEvent.BOOKING_CREATED,
  conditions: [
    {
      field: "booking.priceCents",
      operator: "greaterThan",
      value: 10000  // Bookings over 100€
    }
  ],
  actions: [
    {
      type: "sms",
      config: {
        message: "Thank you for your premium booking! We've reserved our best bay for you."
      }
    },
    {
      type: "email",
      config: {
        subject: "VIP Booking Confirmed",
        message: "Dear {customerName}, your premium service is confirmed..."
      }
    }
  ],
  priority: 15
});
```

### Changing Booking Status
```typescript
import { executeStatusTransition } from './lib/status-workflow';

// Staff starts service
await executeStatusTransition(
  bookingId,
  BookingStatus.IN_PROGRESS,
  'staff',
  'staff@example.com',
  'Customer arrived on time'
);

// Admin completes service
await executeStatusTransition(
  bookingId,
  BookingStatus.COMPLETED,
  'admin',
  'admin@example.com',
  'Service completed successfully',
  'Customer very satisfied with result'
);
```

## 🏆 Summary

We've successfully integrated TastyIgniter's enterprise-grade reservation system features into your car wash booking platform, including:

✅ Multi-resource (wash bay) management
✅ Smart bay assignment algorithm
✅ Staff management and assignment
✅ Role-based status workflow
✅ Complete audit trail (status history)
✅ Event-driven automation engine
✅ Flexible notification system (Email + SMS + Push)
✅ Configuration-driven behavior
✅ Time-based cancellation policies
✅ Capacity management
✅ Booking lifecycle events

Your booking system now has the same powerful features as TastyIgniter's restaurant reservation system, adapted perfectly for the car wash industry while maintaining your existing Next.js/TypeScript/Prisma architecture.
