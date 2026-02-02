/**
 * Feedback-related type definitions
 * User feedback for reporting issues
 */

import type { Event, EventHint, User } from './sentry';

/**
 * Feedback event data structure.
 */
export interface FeedbackEvent {
  /**
   * The feedback message from the user.
   */
  message: string;

  /**
   * The user's email address.
   */
  email?: string;

  /**
   * The user's name.
   */
  name?: string;

  /**
   * The URL where the feedback was submitted.
   */
  url?: string;

  /**
   * Source of the feedback (e.g., 'widget', 'api', 'custom').
   */
  source?: string;

  /**
   * Associated event ID if this feedback relates to an error.
   */
  associatedEventId?: string;

  /**
   * Tags for the feedback.
   */
  tags?: Record<string, string>;

  /**
   * Additional contact email (if different from user email).
   */
  contactEmail?: string;

  /**
   * Screenshot or attachment data.
   */
  attachments?: FeedbackAttachment[];
}

/**
 * Attachment for feedback.
 */
export interface FeedbackAttachment {
  /**
   * The filename.
   */
  filename: string;

  /**
   * The attachment data (base64 encoded or raw bytes).
   */
  data: string | Uint8Array;

  /**
   * MIME content type.
   */
  contentType?: string;
}

/**
 * Options for sending feedback.
 */
export interface SendFeedbackOptions {
  /**
   * Whether to include replay data with the feedback.
   */
  includeReplay?: boolean;

  /**
   * Event hint for additional context.
   */
  hint?: EventHint;

  /**
   * Capture context to apply.
   */
  captureContext?: Partial<{
    user: User;
    tags: Record<string, string>;
    extra: Record<string, unknown>;
  }>;
}

/**
 * Feedback form configuration.
 */
export interface FeedbackFormConfig {
  /**
   * Placeholder text for the message field.
   */
  messagePlaceholder?: string;

  /**
   * Placeholder text for the email field.
   */
  emailPlaceholder?: string;

  /**
   * Placeholder text for the name field.
   */
  namePlaceholder?: string;

  /**
   * Label for the message field.
   */
  messageLabel?: string;

  /**
   * Label for the email field.
   */
  emailLabel?: string;

  /**
   * Label for the name field.
   */
  nameLabel?: string;

  /**
   * Whether the email field is required.
   */
  emailRequired?: boolean;

  /**
   * Whether the name field is required.
   */
  nameRequired?: boolean;

  /**
   * Submit button text.
   */
  submitButtonLabel?: string;

  /**
   * Cancel button text.
   */
  cancelButtonLabel?: string;

  /**
   * Success message shown after submission.
   */
  successMessage?: string;

  /**
   * Error message shown when submission fails.
   */
  errorMessage?: string;

  /**
   * Form title.
   */
  title?: string;

  /**
   * Form subtitle/description.
   */
  subtitle?: string;

  /**
   * Whether to show branding.
   */
  showBranding?: boolean;

  /**
   * Whether to show the screenshot button.
   */
  showScreenshot?: boolean;

  /**
   * Whether to show the name field.
   */
  showName?: boolean;

  /**
   * Whether to show the email field.
   */
  showEmail?: boolean;

  /**
   * Whether to auto-inject CSS styles.
   */
  autoInject?: boolean;

  /**
   * Theme for the form.
   */
  theme?: 'light' | 'dark' | 'system';

  /**
   * Color scheme customization.
   */
  colorScheme?: FeedbackColorScheme;
}

/**
 * Color scheme for feedback form.
 */
export interface FeedbackColorScheme {
  /**
   * Background color.
   */
  background?: string;

  /**
   * Background color on hover.
   */
  backgroundHover?: string;

  /**
   * Foreground/text color.
   */
  foreground?: string;

  /**
   * Border color.
   */
  border?: string;

  /**
   * Primary/accent color.
   */
  accentBackground?: string;

  /**
   * Primary/accent foreground color.
   */
  accentForeground?: string;

  /**
   * Success color.
   */
  success?: string;

  /**
   * Error color.
   */
  error?: string;
}

/**
 * Feedback widget configuration.
 */
export interface FeedbackWidgetConfig extends FeedbackFormConfig {
  /**
   * Whether to show the feedback button.
   */
  showButton?: boolean;

  /**
   * Button text.
   */
  buttonLabel?: string;

  /**
   * Button position.
   */
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /**
   * Trigger element selector (if not using default button).
   */
  triggerSelector?: string;

  /**
   * Callback when feedback is submitted.
   */
  onSubmit?: (feedback: FeedbackEvent) => void | Promise<void>;

  /**
   * Callback when the form is opened.
   */
  onOpen?: () => void;

  /**
   * Callback when the form is closed.
   */
  onClose?: () => void;

  /**
   * Callback when an error occurs.
   */
  onError?: (error: Error) => void;
}

/**
 * Internal feedback event structure (after processing).
 */
export interface FeedbackInternalEvent extends Event {
  /**
   * Event type.
   */
  type: 'feedback';

  /**
   * Feedback-specific contexts.
   */
  contexts: Event['contexts'] & {
    feedback: {
      message: string;
      contact_email?: string;
      name?: string;
      url?: string;
      source?: string;
      associated_event_id?: string;
    };
  };
}

/**
 * User report (legacy feedback format).
 */
export interface UserReport {
  /**
   * Associated event ID.
   */
  event_id: string;

  /**
   * User's name.
   */
  name: string;

  /**
   * User's email.
   */
  email: string;

  /**
   * User's comments/feedback.
   */
  comments: string;
}

/**
 * Feedback submission result.
 */
export interface FeedbackResult {
  /**
   * Whether the submission was successful.
   */
  success: boolean;

  /**
   * Event ID if successful.
   */
  eventId?: string;

  /**
   * Error message if failed.
   */
  error?: string;
}

/**
 * Screenshot data for feedback.
 */
export interface FeedbackScreenshot {
  /**
   * The screenshot as a data URL or base64.
   */
  data: string;

  /**
   * Filename for the screenshot.
   */
  filename?: string;

  /**
   * MIME type.
   */
  contentType?: string;

  /**
   * Width in pixels.
   */
  width?: number;

  /**
   * Height in pixels.
   */
  height?: number;
}
