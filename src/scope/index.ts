/**
 * Scope Module
 *
 * Exports scope-related classes and utilities for managing
 * contextual data that is applied to events.
 */

// Scope class and types
export {
  Scope,
  type EventProcessor,
  type Span,
  type ScopeData,
} from './scope.js';

// Scope manager
export {
  ScopeManager,
  getDefaultScopeManager,
  resetDefaultScopeManager,
} from './scopeManager.js';

// Propagation context
export {
  type PropagationContext,
  type DynamicSamplingContext,
  generatePropagationContext,
  generateTraceId,
  generateSpanId,
  createChildPropagationContext,
  parseTraceparent,
  serializeTraceparent,
  parseBaggage,
  serializeBaggage,
  extractPropagationContext,
  injectPropagationContext,
} from './propagationContext.js';
