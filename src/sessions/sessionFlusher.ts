/**
 * Session Flusher
 *
 * Handles batching and flushing of session updates to a transport.
 * This is used to efficiently send session data to a backend service.
 */

import { Session, type SessionData } from './session.js';

/**
 * Transport interface for sending session data
 */
export interface SessionTransport {
  /**
   * Sends session data to the backend
   * @param sessions - Array of session data to send
   */
  sendSessions(sessions: SessionData[]): Promise<void>;
}

/**
 * Options for the session flusher
 */
export interface SessionFlusherOptions {
  /** Flush interval in milliseconds (default: 60 seconds) */
  flushInterval?: number;
  /** Maximum sessions to batch before forcing a flush (default: 30) */
  maxBatchSize?: number;
  /** Release version for session aggregation */
  release?: string;
  /** Environment for session aggregation */
  environment?: string;
}

/**
 * Session aggregate data for efficient transmission
 */
export interface SessionAggregates {
  /** Timestamp bucket for aggregation */
  started: string;
  /** Number of sessions started */
  exited?: number;
  /** Number of errored sessions */
  errored?: number;
  /** Number of crashed sessions */
  crashed?: number;
  /** Number of abnormal sessions */
  abnormal?: number;
}

/**
 * Session envelope for batch transmission
 */
export interface SessionEnvelope {
  /** Session aggregates by time bucket */
  aggregates: SessionAggregates[];
  /** Release version */
  attrs?: {
    release?: string;
    environment?: string;
  };
}

/**
 * Session Flusher for batching and sending session updates
 */
export class SessionFlusher {
  private pendingSessions: Session[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | undefined;
  private transport: SessionTransport;
  private options: Required<SessionFlusherOptions>;
  private isClosing: boolean = false;

  /**
   * Creates a new SessionFlusher
   * @param transport - Transport for sending sessions
   * @param options - Flusher options
   */
  constructor(transport: SessionTransport, options: SessionFlusherOptions = {}) {
    this.transport = transport;
    this.options = {
      flushInterval: 60 * 1000, // 60 seconds
      maxBatchSize: 30,
      release: options.release || '',
      environment: options.environment || '',
      ...options,
    };

    // Start the flush timer
    this.scheduleFlush();
  }

  /**
   * Adds a session to the pending queue
   * @param session - Session to add
   */
  addSession(session: Session): void {
    if (this.isClosing) {
      return;
    }

    this.pendingSessions.push(session);

    // Force flush if we've hit the batch size limit
    if (this.pendingSessions.length >= this.options.maxBatchSize) {
      this.flush().catch((err) => {
        console.error('Failed to flush sessions:', err);
      });
    }
  }

  /**
   * Flushes all pending sessions to the transport
   */
  async flush(): Promise<void> {
    // Clear any pending flush timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    // Get and clear pending sessions
    const sessionsToFlush = this.pendingSessions;
    this.pendingSessions = [];

    if (sessionsToFlush.length === 0) {
      // Reschedule if not closing
      if (!this.isClosing) {
        this.scheduleFlush();
      }
      return;
    }

    try {
      // Convert sessions to data
      const sessionData = sessionsToFlush.map((s) => s.toJSON());

      // Send to transport
      await this.transport.sendSessions(sessionData);
    } catch (error) {
      // On error, add sessions back to pending (at the front)
      this.pendingSessions = [...sessionsToFlush, ...this.pendingSessions];

      // Truncate to max batch size to prevent unbounded growth
      if (this.pendingSessions.length > this.options.maxBatchSize * 2) {
        this.pendingSessions = this.pendingSessions.slice(
          -this.options.maxBatchSize * 2
        );
      }

      throw error;
    } finally {
      // Reschedule if not closing
      if (!this.isClosing) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Schedules the next flush
   */
  private scheduleFlush(): void {
    if (this.flushTimeout || this.isClosing) {
      return;
    }

    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = undefined;
      this.flush().catch((err) => {
        console.error('Scheduled flush failed:', err);
      });
    }, this.options.flushInterval);
  }

  /**
   * Closes the flusher, flushing any remaining sessions
   */
  async close(): Promise<void> {
    this.isClosing = true;

    // Clear the flush timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    // Flush any remaining sessions
    if (this.pendingSessions.length > 0) {
      try {
        await this.flush();
      } catch (error) {
        console.error('Failed to flush sessions on close:', error);
      }
    }
  }

  /**
   * Gets the number of pending sessions
   */
  getPendingCount(): number {
    return this.pendingSessions.length;
  }

  /**
   * Aggregates sessions into time buckets for efficient transmission
   * @param sessions - Sessions to aggregate
   * @returns Aggregated session data
   */
  aggregateSessions(sessions: SessionData[]): SessionEnvelope {
    // Group by hour bucket
    const buckets = new Map<string, SessionAggregates>();

    for (const session of sessions) {
      // Get hour bucket from started timestamp
      const startDate = new Date(session.started);
      startDate.setMinutes(0, 0, 0);
      const bucketKey = startDate.toISOString();

      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = { started: bucketKey };
        buckets.set(bucketKey, bucket);
      }

      // Increment appropriate counter based on status
      switch (session.status) {
        case 'exited':
        case 'ok':
          bucket.exited = (bucket.exited || 0) + 1;
          break;
        case 'crashed':
          bucket.crashed = (bucket.crashed || 0) + 1;
          break;
        case 'abnormal':
          bucket.abnormal = (bucket.abnormal || 0) + 1;
          break;
      }

      // If there were errors, also count as errored
      if (session.errors > 0) {
        bucket.errored = (bucket.errored || 0) + 1;
      }
    }

    return {
      aggregates: Array.from(buckets.values()),
      attrs: {
        release: this.options.release || undefined,
        environment: this.options.environment || undefined,
      },
    };
  }

  /**
   * Creates individual session updates (non-aggregated)
   * Used when detailed session data is needed
   * @param sessions - Sessions to format
   * @returns Formatted session data
   */
  formatIndividualSessions(sessions: SessionData[]): SessionData[] {
    return sessions.map((session) => ({
      ...session,
      attrs: {
        ...session.attrs,
        release: session.attrs?.release || this.options.release,
        environment: session.attrs?.environment || this.options.environment,
      },
    }));
  }
}

/**
 * No-op transport for testing or when session sending is disabled
 */
export class NoOpSessionTransport implements SessionTransport {
  async sendSessions(_sessions: SessionData[]): Promise<void> {
    // Do nothing
  }
}

/**
 * Console transport for debugging
 */
export class ConsoleSessionTransport implements SessionTransport {
  async sendSessions(sessions: SessionData[]): Promise<void> {
    console.log('[Sessions]', JSON.stringify(sessions, null, 2));
  }
}
