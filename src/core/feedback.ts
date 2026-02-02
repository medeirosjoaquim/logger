/**
 * Feedback API
 *
 * Provides functions for capturing user feedback as Sentry events.
 */

import { UniversalLogger } from './logger.js';
import type { Event, EventHint } from '../types/sentry.js';

/**
 * Feedback event data
 */
export interface FeedbackEvent {
  /** User's feedback message */
  message: string;
  /** User's email address (optional) */
  email?: string;
  /** User's name (optional) */
  name?: string;
  /** URL where the feedback was submitted (optional) */
  url?: string;
  /** Source of the feedback (optional) */
  source?: 'widget' | 'api' | 'custom';
  /** Associated event ID (optional) */
  associatedEventId?: string;
}

/**
 * Options for sending feedback
 */
export interface SendFeedbackOptions {
  /** Include replay data if available */
  includeReplay?: boolean;
  /** Custom tags to attach */
  tags?: Record<string, string>;
  /** Custom context to attach */
  context?: Record<string, unknown>;
}

/**
 * Capture user feedback and return the event ID
 *
 * @param feedback - The feedback data
 * @param hint - Optional event hint
 * @returns The event ID
 */
export function captureFeedback(feedback: FeedbackEvent, hint?: EventHint): string {
  const logger = UniversalLogger.getInstance();

  const event: Event = {
    type: 'feedback' as unknown as undefined, // Type extension for feedback
    level: 'info',
    contexts: {
      feedback: {
        message: feedback.message,
        contact_email: feedback.email,
        name: feedback.name,
        url: feedback.url || (typeof window !== 'undefined' ? window.location?.href : undefined),
        source: feedback.source || 'api',
      },
    },
  };

  // Associate with an existing event if provided
  if (feedback.associatedEventId) {
    event.contexts = {
      ...event.contexts,
      associatedEvent: {
        event_id: feedback.associatedEventId,
      },
    };
  }

  return logger.captureEvent(event, hint);
}

/**
 * Send user feedback asynchronously
 *
 * This is the async version of captureFeedback that can include
 * additional processing like replay data.
 *
 * @param feedback - The feedback data
 * @param options - Optional send options
 * @returns Promise resolving to the event ID
 */
export async function sendFeedback(
  feedback: FeedbackEvent,
  options?: SendFeedbackOptions
): Promise<string> {
  const logger = UniversalLogger.getInstance();

  const event: Event = {
    type: 'feedback' as unknown as undefined,
    level: 'info',
    contexts: {
      feedback: {
        message: feedback.message,
        contact_email: feedback.email,
        name: feedback.name,
        url: feedback.url || (typeof window !== 'undefined' ? window.location?.href : undefined),
        source: feedback.source || 'api',
      },
    },
  };

  // Add custom tags
  if (options?.tags) {
    event.tags = { ...event.tags, ...options.tags };
  }

  // Add custom context
  if (options?.context) {
    event.contexts = {
      ...event.contexts,
      custom: options.context,
    };
  }

  // Associate with an existing event if provided
  if (feedback.associatedEventId) {
    event.contexts = {
      ...event.contexts,
      associatedEvent: {
        event_id: feedback.associatedEventId,
      },
    };
  }

  return logger.captureEvent(event);
}

/**
 * Create a feedback widget attachment point
 *
 * Returns a function that can be called to open the feedback widget.
 * This is a no-op in standalone mode but allows for future integration.
 *
 * @returns Function to open feedback widget
 */
export function createFeedbackWidget(): () => void {
  // In standalone mode, just log a message
  // This allows for integration with a UI library
  return () => {
    console.info('[Feedback] Feedback widget requested. Implement UI integration.');
  };
}

/**
 * Feedback form field configuration
 */
export interface FeedbackFormConfig {
  /** Show name field */
  showName?: boolean;
  /** Show email field */
  showEmail?: boolean;
  /** Name field label */
  nameLabel?: string;
  /** Email field label */
  emailLabel?: string;
  /** Message field label */
  messageLabel?: string;
  /** Submit button label */
  submitLabel?: string;
  /** Success message */
  successMessage?: string;
  /** Form title */
  title?: string;
  /** Form subtitle */
  subtitle?: string;
}

/**
 * Default feedback form configuration
 */
export const defaultFeedbackFormConfig: FeedbackFormConfig = {
  showName: true,
  showEmail: true,
  nameLabel: 'Name',
  emailLabel: 'Email',
  messageLabel: 'What went wrong? What did you expect?',
  submitLabel: 'Submit Feedback',
  successMessage: 'Thank you for your feedback!',
  title: 'Report a Bug',
  subtitle: 'Please describe what happened',
};

/**
 * Validate feedback data
 *
 * @param feedback - The feedback to validate
 * @returns Validation result
 */
export function validateFeedback(feedback: Partial<FeedbackEvent>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!feedback.message || feedback.message.trim().length === 0) {
    errors.push('Message is required');
  }

  if (feedback.email && !isValidEmail(feedback.email)) {
    errors.push('Invalid email address');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
