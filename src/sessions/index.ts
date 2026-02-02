/**
 * Sessions Module
 *
 * Exports session-related classes and utilities for tracking
 * user sessions and their health metrics.
 */

// Session class and types
export {
  Session,
  type SessionStatus,
  type SessionAttributes,
  type SessionData,
  type SessionContext,
} from './session.js';

// Session manager
export {
  SessionManager,
  type SessionManagerOptions,
} from './sessionManager.js';

// Session flusher
export {
  SessionFlusher,
  NoOpSessionTransport,
  ConsoleSessionTransport,
  type SessionTransport,
  type SessionFlusherOptions,
  type SessionAggregates,
  type SessionEnvelope,
} from './sessionFlusher.js';
