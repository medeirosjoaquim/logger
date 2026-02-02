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

// ============================================
// Report Dialog
// ============================================

/**
 * Options for the report dialog
 */
export interface ReportDialogOptions {
  /** Associated event ID (e.g., from captureException) */
  eventId?: string;
  /** Pre-fill user information */
  user?: { email?: string; name?: string };
  /** Dialog title */
  title?: string;
  /** Dialog subtitle/description */
  subtitle?: string;
  /** Label for name field */
  labelName?: string;
  /** Label for email field */
  labelEmail?: string;
  /** Label for comments/message field */
  labelComments?: string;
  /** Label for submit button */
  labelSubmit?: string;
  /** Label for close button */
  labelClose?: string;
  /** Callback when dialog loads */
  onLoad?: () => void;
  /** Callback when feedback is submitted */
  onSubmit?: (feedback: FeedbackEvent) => void;
  /** Callback when dialog is closed */
  onClose?: () => void;
  /** Enable screenshot capture */
  enableScreenshot?: boolean;
  /** Label for screenshot button */
  labelScreenshot?: string;
}

/**
 * Default labels for the report dialog
 */
const defaultDialogLabels = {
  title: 'Report a Bug',
  subtitle: "Tell us what happened. We'll use this to fix the issue.",
  labelName: 'Name',
  labelEmail: 'Email',
  labelComments: 'What happened?',
  labelSubmit: 'Submit Feedback',
  labelClose: 'Cancel',
  labelScreenshot: 'Include Screenshot',
};

/**
 * CSS styles for the feedback dialog (inline, no external dependencies)
 */
const dialogStyles = `
  .sentry-feedback-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .sentry-feedback-dialog {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    max-width: 440px;
    width: 100%;
    margin: 16px;
    overflow: hidden;
  }

  .sentry-feedback-header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .sentry-feedback-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 4px 0;
  }

  .sentry-feedback-subtitle {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .sentry-feedback-body {
    padding: 20px 24px;
  }

  .sentry-feedback-field {
    margin-bottom: 16px;
  }

  .sentry-feedback-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }

  .sentry-feedback-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .sentry-feedback-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .sentry-feedback-textarea {
    min-height: 100px;
    resize: vertical;
  }

  .sentry-feedback-screenshot-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .sentry-feedback-screenshot-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 14px;
    color: #374151;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .sentry-feedback-screenshot-btn:hover {
    background: #e5e7eb;
  }

  .sentry-feedback-screenshot-btn.has-screenshot {
    color: #059669;
    background: #d1fae5;
    border-color: #6ee7b7;
  }

  .sentry-feedback-screenshot-preview {
    max-width: 80px;
    max-height: 60px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
  }

  .sentry-feedback-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .sentry-feedback-btn {
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .sentry-feedback-btn-cancel {
    color: #374151;
    background: #fff;
    border: 1px solid #d1d5db;
  }

  .sentry-feedback-btn-cancel:hover {
    background: #f3f4f6;
  }

  .sentry-feedback-btn-submit {
    color: #fff;
    background: #6366f1;
    border: 1px solid #6366f1;
  }

  .sentry-feedback-btn-submit:hover {
    background: #4f46e5;
    border-color: #4f46e5;
  }

  .sentry-feedback-btn-submit:disabled {
    background: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }

  .sentry-feedback-error {
    color: #dc2626;
    font-size: 12px;
    margin-top: 4px;
  }

  .sentry-feedback-success {
    text-align: center;
    padding: 40px 24px;
  }

  .sentry-feedback-success-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .sentry-feedback-success-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
  }

  .sentry-feedback-success-text {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }
`;

/**
 * Feedback with optional screenshot attachment
 */
export interface FeedbackWithScreenshot extends FeedbackEvent {
  /** Screenshot blob */
  screenshot?: Blob;
}

/** Active dialog instance reference */
let activeDialog: HTMLElement | null = null;

/**
 * Show a modal dialog for collecting user feedback
 *
 * Creates a Sentry-like modal for users to report bugs or provide feedback.
 * The dialog includes name, email, and message fields with optional screenshot.
 *
 * @param options - Dialog configuration options
 */
export function showReportDialog(options: ReportDialogOptions = {}): void {
  // Only allow one dialog at a time
  if (activeDialog) {
    return;
  }

  // Ensure we're in a browser environment
  if (typeof document === 'undefined') {
    console.warn('[Feedback] showReportDialog requires a browser environment');
    return;
  }

  const labels = {
    title: options.title ?? defaultDialogLabels.title,
    subtitle: options.subtitle ?? defaultDialogLabels.subtitle,
    labelName: options.labelName ?? defaultDialogLabels.labelName,
    labelEmail: options.labelEmail ?? defaultDialogLabels.labelEmail,
    labelComments: options.labelComments ?? defaultDialogLabels.labelComments,
    labelSubmit: options.labelSubmit ?? defaultDialogLabels.labelSubmit,
    labelClose: options.labelClose ?? defaultDialogLabels.labelClose,
    labelScreenshot: options.labelScreenshot ?? defaultDialogLabels.labelScreenshot,
  };

  // Inject styles if not already present
  if (!document.getElementById('sentry-feedback-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sentry-feedback-styles';
    styleEl.textContent = dialogStyles;
    document.head.appendChild(styleEl);
  }

  // State
  let screenshotBlob: Blob | null = null;
  let screenshotUrl: string | null = null;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sentry-feedback-overlay';
  activeDialog = overlay;

  // Create dialog content
  overlay.innerHTML = `
    <div class="sentry-feedback-dialog" role="dialog" aria-labelledby="sentry-feedback-title">
      <div class="sentry-feedback-header">
        <h2 class="sentry-feedback-title" id="sentry-feedback-title">${escapeHtml(labels.title)}</h2>
        <p class="sentry-feedback-subtitle">${escapeHtml(labels.subtitle)}</p>
      </div>
      <form class="sentry-feedback-form">
        <div class="sentry-feedback-body">
          <div class="sentry-feedback-field">
            <label class="sentry-feedback-label" for="sentry-feedback-name">${escapeHtml(labels.labelName)}</label>
            <input
              type="text"
              id="sentry-feedback-name"
              class="sentry-feedback-input"
              value="${escapeHtml(options.user?.name ?? '')}"
              placeholder="Your name"
            />
          </div>
          <div class="sentry-feedback-field">
            <label class="sentry-feedback-label" for="sentry-feedback-email">${escapeHtml(labels.labelEmail)}</label>
            <input
              type="email"
              id="sentry-feedback-email"
              class="sentry-feedback-input"
              value="${escapeHtml(options.user?.email ?? '')}"
              placeholder="your.email@example.com"
            />
            <div class="sentry-feedback-error" id="sentry-feedback-email-error" style="display: none;"></div>
          </div>
          <div class="sentry-feedback-field">
            <label class="sentry-feedback-label" for="sentry-feedback-message">${escapeHtml(labels.labelComments)} *</label>
            <textarea
              id="sentry-feedback-message"
              class="sentry-feedback-input sentry-feedback-textarea"
              placeholder="Please describe what happened..."
              required
            ></textarea>
            <div class="sentry-feedback-error" id="sentry-feedback-message-error" style="display: none;"></div>
          </div>
          ${options.enableScreenshot ? `
          <div class="sentry-feedback-screenshot-row">
            <button type="button" class="sentry-feedback-screenshot-btn" id="sentry-feedback-screenshot-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4h8v8H4V4zm1 1v6h6V5H5z"/>
                <path d="M2 2v3h1V3h2V2H2zm9 0v1h2v2h1V2h-3zM2 11v3h3v-1H3v-2H2zm11 0v2h-2v1h3v-3h-1z"/>
              </svg>
              ${escapeHtml(labels.labelScreenshot)}
            </button>
            <img id="sentry-feedback-screenshot-preview" class="sentry-feedback-screenshot-preview" style="display: none;" alt="Screenshot preview" />
          </div>
          ` : ''}
        </div>
        <div class="sentry-feedback-footer">
          <button type="button" class="sentry-feedback-btn sentry-feedback-btn-cancel" id="sentry-feedback-cancel">
            ${escapeHtml(labels.labelClose)}
          </button>
          <button type="submit" class="sentry-feedback-btn sentry-feedback-btn-submit" id="sentry-feedback-submit">
            ${escapeHtml(labels.labelSubmit)}
          </button>
        </div>
      </form>
    </div>
  `;

  // Append to body
  document.body.appendChild(overlay);

  // Get form elements
  const form = overlay.querySelector('.sentry-feedback-form') as HTMLFormElement;
  const nameInput = overlay.querySelector('#sentry-feedback-name') as HTMLInputElement;
  const emailInput = overlay.querySelector('#sentry-feedback-email') as HTMLInputElement;
  const messageInput = overlay.querySelector('#sentry-feedback-message') as HTMLTextAreaElement;
  const cancelBtn = overlay.querySelector('#sentry-feedback-cancel') as HTMLButtonElement;
  const submitBtn = overlay.querySelector('#sentry-feedback-submit') as HTMLButtonElement;
  const emailError = overlay.querySelector('#sentry-feedback-email-error') as HTMLDivElement;
  const messageError = overlay.querySelector('#sentry-feedback-message-error') as HTMLDivElement;
  const screenshotBtn = overlay.querySelector('#sentry-feedback-screenshot-btn') as HTMLButtonElement | null;
  const screenshotPreview = overlay.querySelector('#sentry-feedback-screenshot-preview') as HTMLImageElement | null;

  // Close dialog helper
  const closeDialog = () => {
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
    }
    overlay.remove();
    activeDialog = null;
    options.onClose?.();
  };

  // Show success state
  const showSuccess = () => {
    const dialog = overlay.querySelector('.sentry-feedback-dialog') as HTMLElement;
    dialog.innerHTML = `
      <div class="sentry-feedback-success">
        <div class="sentry-feedback-success-icon">&#10003;</div>
        <h3 class="sentry-feedback-success-title">Thank you!</h3>
        <p class="sentry-feedback-success-text">Your feedback has been submitted successfully.</p>
      </div>
      <div class="sentry-feedback-footer">
        <button type="button" class="sentry-feedback-btn sentry-feedback-btn-submit" id="sentry-feedback-done">
          Done
        </button>
      </div>
    `;
    const doneBtn = overlay.querySelector('#sentry-feedback-done') as HTMLButtonElement;
    doneBtn.addEventListener('click', closeDialog);
  };

  // Event handlers
  cancelBtn.addEventListener('click', closeDialog);

  // Close on overlay click (not dialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
    }
  });

  // Close on Escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // Screenshot button handler
  if (screenshotBtn && screenshotPreview) {
    screenshotBtn.addEventListener('click', async () => {
      try {
        screenshotBtn.disabled = true;
        screenshotBtn.textContent = 'Capturing...';

        // Hide dialog temporarily for screenshot
        overlay.style.display = 'none';

        // Small delay to ensure dialog is hidden
        await new Promise(resolve => setTimeout(resolve, 100));

        const blob = await captureScreenshot();

        // Show dialog again
        overlay.style.display = 'flex';

        if (blob) {
          screenshotBlob = blob;
          if (screenshotUrl) {
            URL.revokeObjectURL(screenshotUrl);
          }
          screenshotUrl = URL.createObjectURL(blob);
          screenshotPreview.src = screenshotUrl;
          screenshotPreview.style.display = 'block';
          screenshotBtn.classList.add('has-screenshot');
          screenshotBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4h8v8H4V4zm1 1v6h6V5H5z"/>
              <path d="M2 2v3h1V3h2V2H2zm9 0v1h2v2h1V2h-3zM2 11v3h3v-1H3v-2H2zm11 0v2h-2v1h3v-3h-1z"/>
            </svg>
            Screenshot captured
          `;
        } else {
          screenshotBtn.textContent = 'Screenshot failed';
        }
      } catch {
        overlay.style.display = 'flex';
        screenshotBtn.textContent = 'Screenshot failed';
      } finally {
        screenshotBtn.disabled = false;
      }
    });
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    emailError.style.display = 'none';
    messageError.style.display = 'none';

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();

    // Validate
    let hasErrors = false;

    if (!message) {
      messageError.textContent = 'Message is required';
      messageError.style.display = 'block';
      hasErrors = true;
    }

    if (email && !isValidEmail(email)) {
      emailError.textContent = 'Please enter a valid email address';
      emailError.style.display = 'block';
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const feedback: FeedbackWithScreenshot = {
        message,
        name: name || undefined,
        email: email || undefined,
        url: typeof window !== 'undefined' ? window.location?.href : undefined,
        source: 'widget',
        associatedEventId: options.eventId,
        screenshot: screenshotBlob ?? undefined,
      };

      // Capture feedback
      captureFeedback(feedback);

      // Call onSubmit callback
      options.onSubmit?.(feedback);

      // Show success
      showSuccess();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = labels.labelSubmit;
      messageError.textContent = 'Failed to submit feedback. Please try again.';
      messageError.style.display = 'block';
      console.error('[Feedback] Error submitting feedback:', error);
    }
  });

  // Focus message input
  messageInput.focus();

  // Call onLoad callback
  options.onLoad?.();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Screenshot Capture
// ============================================

/**
 * Capture a screenshot of the current page
 *
 * Uses the canvas API to capture the visible viewport.
 * For more complex scenarios (cross-origin iframes, CSS transforms),
 * consider using html2canvas library.
 *
 * @returns Promise resolving to a Blob containing the screenshot, or null on failure
 */
export async function captureScreenshot(): Promise<Blob | null> {
  // Check for browser environment
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    console.warn('[Feedback] captureScreenshot requires a browser environment');
    return null;
  }

  try {
    // Try using the native screen capture API if available (requires user gesture and permissions)
    if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });

        // Small delay to ensure frame is rendered
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create canvas and draw video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Convert to blob
        return new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png');
        });
      } catch {
        // User denied permission or API not supported, fall through to canvas fallback
        console.info('[Feedback] Screen capture denied or unavailable, using canvas fallback');
      }
    }

    // Fallback: Use html2canvas-like approach with basic canvas
    // This is a simplified version - for production, consider using html2canvas library
    const canvas = document.createElement('canvas');
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[Feedback] Could not get canvas context');
      return null;
    }

    // Draw a placeholder with page info (actual DOM rendering would require html2canvas)
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#6b7280';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Screenshot capture requires user permission', width / 2, height / 2 - 20);
    ctx.fillText('URL: ' + window.location.href, width / 2, height / 2 + 10);
    ctx.fillText('Time: ' + new Date().toISOString(), width / 2, height / 2 + 40);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  } catch (error) {
    console.error('[Feedback] Error capturing screenshot:', error);
    return null;
  }
}

// ============================================
// Feedback Widget Button
// ============================================

/**
 * Options for the feedback widget button
 */
export interface FeedbackWidgetOptions {
  /** Show widget immediately on creation */
  autoShow?: boolean;
  /** Position of the widget button */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Label text for the trigger button */
  triggerLabel?: string;
  /** Form configuration passed to the dialog */
  formConfig?: Partial<ReportDialogOptions>;
  /** Button background color */
  buttonColor?: string;
  /** Button text color */
  textColor?: string;
}

/** Widget button styles */
const widgetButtonStyles = `
  .sentry-feedback-widget-btn {
    position: fixed;
    z-index: 999998;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .sentry-feedback-widget-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
  }

  .sentry-feedback-widget-btn:active {
    transform: translateY(0);
  }

  .sentry-feedback-widget-btn.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .sentry-feedback-widget-btn.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .sentry-feedback-widget-btn.top-right {
    top: 20px;
    right: 20px;
  }

  .sentry-feedback-widget-btn.top-left {
    top: 20px;
    left: 20px;
  }
`;

/**
 * Create a floating feedback widget button
 *
 * Creates a floating button that opens the feedback dialog when clicked.
 * The button can be positioned in any corner of the viewport.
 *
 * @param options - Widget configuration options
 * @returns The created button element (or null in non-browser environments)
 */
export function createFeedbackWidgetButton(options: FeedbackWidgetOptions = {}): HTMLElement | null {
  // Check for browser environment
  if (typeof document === 'undefined') {
    console.warn('[Feedback] createFeedbackWidgetButton requires a browser environment');
    return null;
  }

  const {
    autoShow = true,
    position = 'bottom-right',
    triggerLabel = 'Report a Bug',
    formConfig = {},
    buttonColor,
    textColor,
  } = options;

  // Inject widget styles if not already present
  if (!document.getElementById('sentry-feedback-widget-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sentry-feedback-widget-styles';
    styleEl.textContent = widgetButtonStyles;
    document.head.appendChild(styleEl);
  }

  // Create button element
  const button = document.createElement('button');
  button.className = `sentry-feedback-widget-btn ${position}`;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', triggerLabel);

  // Apply custom colors if provided
  if (buttonColor) {
    button.style.background = buttonColor;
    button.style.boxShadow = `0 4px 12px ${buttonColor}4d`;
  }
  if (textColor) {
    button.style.color = textColor;
  }

  // Button content with icon
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1C4.134 1 1 3.582 1 6.75c0 1.754.936 3.317 2.406 4.357-.149.64-.45 1.589-.986 2.47-.087.143.08.31.234.244 1.154-.498 2.067-1.04 2.682-1.453.52.115 1.073.176 1.647.176 3.866 0 7-2.582 7-5.794S11.866 1 8 1z"/>
    </svg>
    ${escapeHtml(triggerLabel)}
  `;

  // Click handler
  button.addEventListener('click', () => {
    showReportDialog({
      enableScreenshot: true,
      ...formConfig,
    });
  });

  // Auto-append to body if autoShow is true
  if (autoShow) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(button);
      });
    } else {
      document.body.appendChild(button);
    }
  }

  return button;
}

/**
 * Remove the feedback widget button from the DOM
 *
 * @param button - The button element to remove (returned from createFeedbackWidgetButton)
 */
export function removeFeedbackWidgetButton(button: HTMLElement | null): void {
  if (button && button.parentNode) {
    button.parentNode.removeChild(button);
  }
}
