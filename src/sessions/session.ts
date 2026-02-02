/**
 * Session Implementation
 *
 * Represents a user session for tracking errors and health.
 * Compatible with Sentry's session tracking protocol.
 */

/**
 * Session status values
 * - 'ok': Session is healthy, no errors occurred
 * - 'exited': Session ended normally
 * - 'crashed': Session crashed (unhandled exception)
 * - 'abnormal': Session ended abnormally (e.g., ANR, force quit)
 */
export type SessionStatus = 'ok' | 'crashed' | 'abnormal' | 'exited';

/**
 * Session attributes that may be set
 */
export interface SessionAttributes {
  /** Release version */
  release?: string;
  /** Environment name */
  environment?: string;
  /** User agent string */
  user_agent?: string;
  /** IP address */
  ip_address?: string;
}

/**
 * Session data structure for serialization
 */
export interface SessionData {
  /** Session ID (UUID) */
  sid: string;
  /** Current session status */
  status: SessionStatus;
  /** Number of errors in this session */
  errors: number;
  /** When the session started (ISO 8601) */
  started: string;
  /** Last update timestamp (ISO 8601) */
  timestamp: string;
  /** Session duration in seconds */
  duration?: number;
  /** Whether this is the initial session update */
  init: boolean;
  /** Session attributes */
  attrs?: SessionAttributes;
}

/**
 * Context for creating or updating a session
 */
export interface SessionContext {
  /** User information */
  user?: {
    id?: string | number;
    email?: string;
    username?: string;
    ip_address?: string;
  };
  /** Release version */
  release?: string;
  /** Environment name */
  environment?: string;
  /** User agent string */
  userAgent?: string;
  /** IP address */
  ipAddress?: string;
  /** Number of errors to add */
  errors?: number;
  /** Session status to set */
  status?: SessionStatus;
  /** Whether the session was started due to SDK init */
  init?: boolean;
}

/**
 * Generates a UUID v4
 */
function generateUuid(): string {
  // Use crypto API if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Session class for tracking user sessions
 */
export class Session {
  private data: SessionData;
  private startTime: number;

  /**
   * Creates a new session
   * @param context - Optional context for initializing the session
   */
  constructor(context?: SessionContext) {
    const now = new Date();
    this.startTime = now.getTime();

    this.data = {
      sid: generateUuid(),
      status: 'ok',
      errors: 0,
      started: now.toISOString(),
      timestamp: now.toISOString(),
      init: true,
    };

    // Apply initial context
    if (context) {
      this.update(context);
    }
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Gets the session ID
   */
  getSid(): string {
    return this.data.sid;
  }

  /**
   * Gets the current session status
   */
  getStatus(): SessionStatus {
    return this.data.status;
  }

  /**
   * Gets the error count
   */
  getErrors(): number {
    return this.data.errors;
  }

  /**
   * Gets the session duration in seconds
   */
  getDuration(): number | undefined {
    return this.data.duration;
  }

  /**
   * Checks if this is the initial session update
   */
  isInit(): boolean {
    return this.data.init;
  }

  /**
   * Gets the session start time as ISO string
   */
  getStarted(): string {
    return this.data.started;
  }

  /**
   * Gets the session attributes
   */
  getAttributes(): SessionAttributes | undefined {
    return this.data.attrs;
  }

  // ===========================================================================
  // Updates
  // ===========================================================================

  /**
   * Updates the session with new context
   * @param context - Context to apply
   */
  update(context?: SessionContext): void {
    if (!context) {
      return;
    }

    // Update timestamp
    this.data.timestamp = new Date().toISOString();

    // Update init flag
    if (context.init !== undefined) {
      this.data.init = context.init;
    } else {
      // After first update, init should be false
      this.data.init = false;
    }

    // Update status
    if (context.status) {
      this.data.status = context.status;
    }

    // Add errors
    if (context.errors !== undefined) {
      this.data.errors += context.errors;
    }

    // Update attributes
    const attrs: SessionAttributes = this.data.attrs || {};

    if (context.release !== undefined) {
      attrs.release = context.release;
    }

    if (context.environment !== undefined) {
      attrs.environment = context.environment;
    }

    if (context.userAgent !== undefined) {
      attrs.user_agent = context.userAgent;
    }

    if (context.ipAddress !== undefined) {
      attrs.ip_address = context.ipAddress;
    }

    // Extract IP from user if provided
    if (context.user?.ip_address !== undefined) {
      attrs.ip_address = context.user.ip_address;
    }

    // Only set attrs if we have at least one attribute
    if (Object.keys(attrs).length > 0) {
      this.data.attrs = attrs;
    }

    // Calculate duration
    this.updateDuration();
  }

  /**
   * Sets the session status
   * @param status - New status
   */
  setStatus(status: SessionStatus): void {
    this.data.status = status;
    this.data.timestamp = new Date().toISOString();
    this.data.init = false;
    this.updateDuration();
  }

  /**
   * Increments the error count by 1
   */
  incrementErrors(): void {
    this.data.errors += 1;
    this.data.timestamp = new Date().toISOString();
    this.data.init = false;
    this.updateDuration();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Closes the session
   * @param status - Final status (defaults to 'exited')
   */
  close(status?: SessionStatus): void {
    this.data.status = status || 'exited';
    this.data.timestamp = new Date().toISOString();
    this.data.init = false;
    this.updateDuration();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Converts the session to a JSON-serializable object
   */
  toJSON(): SessionData {
    return { ...this.data };
  }

  /**
   * Creates a session from serialized data
   * @param data - Session data
   */
  static fromJSON(data: SessionData): Session {
    const session = new Session();
    session.data = { ...data };
    session.startTime = new Date(data.started).getTime();
    return session;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Updates the duration based on elapsed time
   */
  private updateDuration(): void {
    const now = Date.now();
    this.data.duration = Math.floor((now - this.startTime) / 1000);
  }
}
