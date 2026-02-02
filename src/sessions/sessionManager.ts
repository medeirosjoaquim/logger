/**
 * Session Manager
 *
 * Manages the lifecycle of user sessions including creation, updates,
 * error tracking, and persistence to storage.
 */

import type { StorageProvider, LogSession, SeverityLevel } from '../storage/types.js';
import type { Event } from '../types/sentry.js';
import { Session, type SessionContext, type SessionData, type SessionStatus } from './session.js';

/**
 * Options for the session manager
 */
export interface SessionManagerOptions {
  /** Release version */
  release?: string;
  /** Environment name */
  environment?: string;
  /** Whether to auto-start a session on init */
  autoSessionTracking?: boolean;
  /** Session idle timeout in milliseconds (default: 30 minutes) */
  sessionIdleTimeout?: number;
}

/**
 * Session Manager for handling session lifecycle
 */
export class SessionManager {
  private currentSession: Session | undefined;
  private storage: StorageProvider;
  private options: SessionManagerOptions;
  private lastActivity: number = Date.now();
  private idleCheckInterval: ReturnType<typeof setInterval> | undefined;

  /**
   * Creates a new SessionManager
   * @param storage - Storage provider for persisting sessions
   * @param options - Session manager options
   */
  constructor(storage: StorageProvider, options: SessionManagerOptions = {}) {
    this.storage = storage;
    this.options = {
      autoSessionTracking: true,
      sessionIdleTimeout: 30 * 60 * 1000, // 30 minutes
      ...options,
    };

    // Start idle check if auto session tracking is enabled
    if (this.options.autoSessionTracking) {
      this.startIdleCheck();
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Starts a new session
   * @param context - Optional context for the session
   * @returns The new session
   */
  startSession(context?: SessionContext): Session {
    // End any existing session first
    if (this.currentSession) {
      this.endSession();
    }

    // Create new session with release/environment from options
    const sessionContext: SessionContext = {
      release: this.options.release,
      environment: this.options.environment,
      ...context,
    };

    this.currentSession = new Session(sessionContext);
    this.lastActivity = Date.now();

    // Persist the new session
    this.persistSession(this.currentSession).catch((err) => {
      console.error('Failed to persist session:', err);
    });

    return this.currentSession;
  }

  /**
   * Ends the current session
   * @param status - Final status (defaults to 'exited')
   */
  endSession(status?: SessionStatus): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.close(status);

    // Persist the ended session
    this.persistSession(this.currentSession).catch((err) => {
      console.error('Failed to persist ended session:', err);
    });

    this.currentSession = undefined;
  }

  /**
   * Gets the current session
   */
  getCurrentSession(): Session | undefined {
    return this.currentSession;
  }

  // ===========================================================================
  // Capture
  // ===========================================================================

  /**
   * Captures the current session state
   * @param endSession - Whether to end the session after capturing
   */
  captureSession(endSession: boolean = false): void {
    if (!this.currentSession) {
      return;
    }

    // Mark as not init since we're capturing it
    this.currentSession.update({ init: false });

    // Persist the session
    this.persistSession(this.currentSession).catch((err) => {
      console.error('Failed to capture session:', err);
    });

    if (endSession) {
      this.endSession();
    }
  }

  // ===========================================================================
  // Error Tracking
  // ===========================================================================

  /**
   * Updates the session based on an event
   * Increments error count for error-level events
   * @param event - The event to process
   */
  updateSessionFromEvent(event: Event): void {
    if (!this.currentSession) {
      return;
    }

    // Update last activity
    this.lastActivity = Date.now();

    // Check if this is an error event
    const isError =
      event.level === 'error' ||
      event.level === 'fatal' ||
      event.exception?.values?.length;

    if (isError) {
      this.currentSession.incrementErrors();

      // If it's a fatal error, mark session as crashed
      if (event.level === 'fatal') {
        this.currentSession.setStatus('crashed');
      }

      // Persist the updated session
      this.persistSession(this.currentSession).catch((err) => {
        console.error('Failed to persist session after error:', err);
      });
    }
  }

  /**
   * Marks the session as crashed
   * Used for unhandled exceptions
   */
  markSessionCrashed(): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.setStatus('crashed');
    this.currentSession.incrementErrors();

    // Persist immediately since we're crashing
    this.persistSession(this.currentSession).catch((err) => {
      console.error('Failed to persist crashed session:', err);
    });
  }

  /**
   * Marks the session as abnormal
   * Used for ANRs, force quits, etc.
   */
  markSessionAbnormal(): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.setStatus('abnormal');

    // Persist immediately
    this.persistSession(this.currentSession).catch((err) => {
      console.error('Failed to persist abnormal session:', err);
    });
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Persists a session to storage
   * @param session - The session to persist
   */
  private async persistSession(session: Session): Promise<void> {
    const sessionData = session.toJSON();

    // Convert to LogSession format for storage
    const logSession: LogSession = {
      id: sessionData.sid,
      startedAt: sessionData.started,
      endedAt: sessionData.status === 'exited' ? sessionData.timestamp : undefined,
      status: sessionData.status,
      errors: sessionData.errors,
      duration: sessionData.duration,
      release: sessionData.attrs?.release,
      environment: sessionData.attrs?.environment,
      ipAddress: sessionData.attrs?.ip_address,
      userAgent: sessionData.attrs?.user_agent,
    };

    // Check if session exists
    const existing = await this.storage.getSession(logSession.id);

    if (existing) {
      await this.storage.updateSession(logSession.id, {
        status: logSession.status,
        errors: logSession.errors,
        duration: logSession.duration,
        endedAt: logSession.endedAt,
      });
    } else {
      await this.storage.createSession(logSession);
    }
  }

  /**
   * Gets session history from storage
   * @param limit - Maximum number of sessions to return
   */
  async getSessionHistory(limit: number = 50): Promise<SessionData[]> {
    const logSessions = await this.storage.getSessions(limit);

    return logSessions.map((ls) => ({
      sid: ls.id,
      status: ls.status,
      errors: ls.errors,
      started: ls.startedAt,
      timestamp: ls.endedAt || ls.startedAt,
      duration: ls.duration,
      init: false,
      attrs: {
        release: ls.release,
        environment: ls.environment,
        ip_address: ls.ipAddress,
        user_agent: ls.userAgent,
      },
    }));
  }

  // ===========================================================================
  // Idle Detection
  // ===========================================================================

  /**
   * Starts the idle check interval
   */
  private startIdleCheck(): void {
    // Check every minute
    this.idleCheckInterval = setInterval(() => {
      this.checkIdle();
    }, 60 * 1000);
  }

  /**
   * Checks if the session has been idle too long
   */
  private checkIdle(): void {
    if (!this.currentSession || !this.options.sessionIdleTimeout) {
      return;
    }

    const idleTime = Date.now() - this.lastActivity;

    if (idleTime >= this.options.sessionIdleTimeout) {
      // End the idle session and start a new one
      this.endSession();
      this.startSession();
    }
  }

  /**
   * Records activity to reset the idle timer
   */
  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Cleans up the session manager
   */
  close(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = undefined;
    }

    // End any active session
    if (this.currentSession) {
      this.endSession();
    }
  }
}
