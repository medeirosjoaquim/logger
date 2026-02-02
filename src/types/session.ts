/**
 * Session-related type definitions
 * Sessions track user engagement and crash rates
 */

import type { User } from './sentry';

/**
 * Session status values.
 */
export type SessionStatus = 'ok' | 'crashed' | 'abnormal' | 'exited';

/**
 * Session interface representing a user session.
 */
export interface Session {
  /**
   * Unique session identifier (UUID).
   */
  sid: string;

  /**
   * The session status.
   */
  status: SessionStatus;

  /**
   * Number of errors during the session.
   */
  errors: number;

  /**
   * Timestamp when the session started (ISO 8601 or Unix timestamp).
   */
  started: string | number;

  /**
   * Timestamp of the last update (ISO 8601 or Unix timestamp).
   */
  timestamp?: string | number;

  /**
   * Duration of the session in seconds.
   */
  duration?: number;

  /**
   * Whether this is the initial session update.
   */
  init?: boolean;

  /**
   * User information for the session.
   */
  user?: User;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * IP address of the user.
   */
  ipAddress?: string;

  /**
   * User agent string.
   */
  userAgent?: string;

  /**
   * Sequence number for session updates.
   */
  seq?: number;

  /**
   * Distinct ID for the session (user ID or device ID).
   */
  did?: string;

  /**
   * Session attributes.
   */
  attrs?: SessionAttributes;

  /**
   * Whether abnormal mechanism was triggered.
   */
  abnormal_mechanism?: string;

  /**
   * Whether to ignore duration for this session.
   */
  ignoreDuration?: boolean;
}

/**
 * Session attributes for additional metadata.
 */
export interface SessionAttributes {
  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * IP address.
   */
  ip_address?: string;

  /**
   * User agent.
   */
  user_agent?: string;
}

/**
 * Session context for creating sessions.
 */
export interface SessionContext {
  /**
   * User associated with the session.
   */
  user?: User;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * Session ID (auto-generated if not provided).
   */
  sid?: string;

  /**
   * Whether this is the initial session.
   */
  init?: boolean;

  /**
   * Timestamp when the session started.
   */
  started?: string | number;

  /**
   * IP address.
   */
  ipAddress?: string;

  /**
   * User agent.
   */
  userAgent?: string;

  /**
   * Initial error count.
   */
  errors?: number;

  /**
   * Initial status.
   */
  status?: SessionStatus;

  /**
   * Whether to ignore duration for this session.
   */
  ignoreDuration?: boolean;

  /**
   * Additional context data.
   */
  [key: string]: unknown;
}

/**
 * Aggregated sessions for efficient transport.
 */
export interface SessionAggregates {
  /**
   * Aggregated session data.
   */
  aggregates: SessionAggregate[];

  /**
   * Session attributes applied to all aggregates.
   */
  attrs?: SessionAttributes;
}

/**
 * Single aggregate entry.
 */
export interface SessionAggregate {
  /**
   * Timestamp of the aggregate bucket.
   */
  started: string;

  /**
   * Number of sessions started.
   */
  exited?: number;

  /**
   * Number of errored sessions.
   */
  errored?: number;

  /**
   * Number of crashed sessions.
   */
  crashed?: number;

  /**
   * Number of abnormal sessions.
   */
  abnormal?: number;
}

/**
 * Session flusher interface.
 */
export interface SessionFlusher {
  /**
   * Increment error count for the current session.
   */
  incrementErrors(): void;

  /**
   * End the current session.
   */
  endSession(status?: SessionStatus): void;

  /**
   * Flush pending session data.
   */
  flush(): void;

  /**
   * Close the flusher.
   */
  close(): void;

  /**
   * Get the current session.
   */
  getSession(): Session | undefined;

  /**
   * Get pending session aggregates.
   */
  getSessionAggregates(): SessionAggregates;
}

/**
 * Session options for configuration.
 */
export interface SessionOptions {
  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * Session sample rate.
   */
  sampleRate?: number;

  /**
   * Whether to automatically end sessions.
   */
  autoEnd?: boolean;

  /**
   * Session timeout in milliseconds.
   */
  sessionTimeout?: number;
}

/**
 * Request session interface for handling session state per request.
 */
export interface RequestSession {
  /**
   * Session status.
   */
  status: SessionStatus;
}

/**
 * Session replay event interface.
 */
export interface ReplayEvent {
  /**
   * Type of replay event.
   */
  type: 'replay_event';

  /**
   * Replay ID.
   */
  replay_id: string;

  /**
   * Replay type (session or buffer).
   */
  replay_type: 'session' | 'buffer';

  /**
   * Segment ID.
   */
  segment_id: number;

  /**
   * Timestamp.
   */
  timestamp: number;

  /**
   * Replay start timestamp.
   */
  replay_start_timestamp?: number;

  /**
   * Error IDs associated with this replay.
   */
  error_ids: string[];

  /**
   * Trace IDs associated with this replay.
   */
  trace_ids: string[];

  /**
   * URLs visited during the replay.
   */
  urls: string[];

  /**
   * Request context.
   */
  request?: {
    url?: string;
    headers?: Record<string, string>;
  };

  /**
   * Platform identifier.
   */
  platform?: string;

  /**
   * Contexts.
   */
  contexts?: {
    replay?: {
      error_sample_rate?: number;
      session_sample_rate?: number;
    };
  };

  /**
   * SDK information.
   */
  sdk?: {
    name?: string;
    version?: string;
  };

  /**
   * Tags.
   */
  tags?: Record<string, string>;
}

/**
 * Recording segment for replay.
 */
export interface RecordingSegment {
  /**
   * Segment ID.
   */
  segmentId: number;

  /**
   * Replay events in this segment.
   */
  events: unknown[];
}
