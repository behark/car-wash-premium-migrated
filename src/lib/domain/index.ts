/**
 * Domain Layer Exports
 * Enterprise business logic and domain functionality
 */

// Booking domain
export {
  BookingDomain,
  bookingDomain,
  type BookingDomainModel,
  type CustomerInfo,
  type CustomerPreferences,
  type BookingMetadata,
  type BusinessRules,
  type VehicleType,
  type TimeSlotValidationResult,
  type BookingConflict,
} from './booking-domain';

// Business rules engine
export {
  BusinessRulesEngine,
  businessRulesEngine,
  type BusinessRule,
  type RuleCondition,
  type RuleAction,
  type RuleEvaluationContext,
  type RuleEvaluationResult,
  type RuleSetEvaluationResult,
} from './business-rules-engine';

// Workflow engine
export {
  WorkflowEngine,
  workflowEngine,
  createBookingWorkflows,
  type WorkflowStep,
  type WorkflowDefinition,
  type WorkflowInstance,
  type WorkflowContext,
  type WorkflowEvent,
  type WorkflowError,
  type WorkflowStatus,
} from './workflow-engine';