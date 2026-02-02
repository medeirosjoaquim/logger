/**
 * ErrorBoundary Component
 *
 * Sentry-compatible React Error Boundary that captures errors and displays a fallback UI.
 * Drop-in replacement for @sentry/react ErrorBoundary.
 *
 * @example
 * ```tsx
 * import { ErrorBoundary } from '@universal-logger/core';
 *
 * <ErrorBoundary fallback={<ErrorPage />}>
 *   <App />
 * </ErrorBoundary>
 *
 * // Or with render prop
 * <ErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={resetError}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import * as React from 'react';

/**
 * Props passed to the fallback component/render function
 */
export interface FallbackProps {
  /** The error that was caught */
  error: Error;
  /** Component stack trace */
  componentStack: string | null;
  /** Event ID from Sentry capture */
  eventId: string | null;
  /** Function to reset the error boundary and retry */
  resetError: () => void;
}

/**
 * Fallback can be a React node or a render function
 */
export type FallbackRender = (props: FallbackProps) => React.ReactNode;
export type FallbackElement = React.ReactNode | FallbackRender;

/**
 * ErrorBoundary component props
 */
export interface ErrorBoundaryProps {
  /** Children to render when there's no error */
  children: React.ReactNode;

  /**
   * Fallback UI to show when an error occurs.
   * Can be a React element or a function that receives error details.
   */
  fallback?: FallbackElement;

  /**
   * Called before the error is sent to Sentry.
   * Use to add additional context to the scope.
   */
  beforeCapture?: (
    scope: import('../../scope/scope').Scope,
    error: Error,
    componentStack: string | null
  ) => void;

  /**
   * Called when an error is caught.
   * Receives the error, component stack, and event ID.
   */
  onError?: (
    error: Error,
    componentStack: string | null,
    eventId: string | null
  ) => void;

  /**
   * Called when the error boundary resets.
   * Receives the error, component stack, and event ID from the previous error.
   */
  onReset?: (
    error: Error | null,
    componentStack: string | null,
    eventId: string | null
  ) => void;

  /**
   * Called when the error boundary unmounts.
   * Receives the error, component stack, and event ID if there was an error.
   */
  onUnmount?: (
    error: Error | null,
    componentStack: string | null,
    eventId: string | null
  ) => void;

  /**
   * Whether to show the Sentry report dialog after an error.
   * @default false
   */
  showDialog?: boolean;

  /**
   * Options for the Sentry report dialog.
   */
  dialogOptions?: {
    title?: string;
    subtitle?: string;
    subtitle2?: string;
    labelName?: string;
    labelEmail?: string;
    labelComments?: string;
    labelClose?: string;
    labelSubmit?: string;
    successMessage?: string;
  };
}

/**
 * ErrorBoundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  eventId: string | null;
}

// Import types
import type { CaptureContext } from '../../types/sentry.js';
import type { ReportDialogOptions } from '../../core/feedback.js';

// Lazy import to avoid circular dependencies
let captureExceptionFn: ((error: unknown, context?: CaptureContext) => string) | null = null;
let withScopeFn: (<T>(callback: (scope: unknown) => T) => T) | null = null;
let showReportDialogFn: ((options?: ReportDialogOptions) => void) | null = null;

async function ensureImports() {
  if (!captureExceptionFn) {
    const core = await import('../../index.js');
    captureExceptionFn = core.captureException;
    withScopeFn = core.withScope as <T>(callback: (scope: unknown) => T) => T;
    showReportDialogFn = core.showReportDialog;
  }
}

// Try to import synchronously for faster initial load
try {
  // Use require for synchronous import in environments that support it
  const core = require('../../index.js');
  captureExceptionFn = core.captureException;
  withScopeFn = core.withScope;
  showReportDialogFn = core.showReportDialog;
} catch {
  // Will use async import on first error
}

/**
 * React Error Boundary component with Sentry integration.
 *
 * Catches JavaScript errors in child components, logs them to Sentry,
 * and displays a fallback UI.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static displayName = 'ErrorBoundary';

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const componentStack = errorInfo.componentStack || null;

    // Capture to Sentry
    this.captureError(error, componentStack);
  }

  private async captureError(error: Error, componentStack: string | null): Promise<void> {
    const { beforeCapture, onError, showDialog, dialogOptions } = this.props;

    await ensureImports();

    let eventId: string | null = null;

    if (withScopeFn && captureExceptionFn) {
      eventId = withScopeFn((scope: unknown) => {
        const typedScope = scope as import('../../scope/scope').Scope;

        // Set component stack as extra data
        if (componentStack) {
          typedScope.setExtra('componentStack', componentStack);
        }

        // Set mechanism
        typedScope.setTag('mechanism', 'react.error_boundary');

        // Call beforeCapture hook
        if (beforeCapture) {
          beforeCapture(typedScope, error, componentStack);
        }

        // Capture the exception
        return captureExceptionFn!(error);
      });
    }

    // Update state with captured info
    this.setState({ componentStack, eventId });

    // Call onError callback
    if (onError) {
      onError(error, componentStack, eventId);
    }

    // Show report dialog if requested
    if (showDialog && showReportDialogFn && eventId) {
      showReportDialogFn({
        eventId,
        ...dialogOptions,
      });
    }
  }

  resetError = (): void => {
    const { onReset } = this.props;
    const { error, componentStack, eventId } = this.state;

    if (onReset) {
      onReset(error, componentStack, eventId);
    }

    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      eventId: null,
    });
  };

  componentWillUnmount(): void {
    const { onUnmount } = this.props;
    const { error, componentStack, eventId } = this.state;

    if (onUnmount) {
      onUnmount(error, componentStack, eventId);
    }
  }

  render(): React.ReactNode {
    const { hasError, error, componentStack, eventId } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If fallback is a function, call it with props
      if (typeof fallback === 'function') {
        return fallback({
          error,
          componentStack,
          eventId,
          resetError: this.resetError,
        });
      }

      // If fallback is provided as a React element, render it
      if (fallback !== undefined) {
        return fallback;
      }

      // Default fallback
      return (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            margin: '10px',
          }}
        >
          <h2 style={{ color: '#dc2626', margin: '0 0 10px 0' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#7f1d1d', margin: '0 0 10px 0' }}>
            {error.message}
          </p>
          <button
            onClick={this.resetError}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Options for withErrorBoundary HOC
 */
export interface WithErrorBoundaryOptions
  extends Omit<ErrorBoundaryProps, 'children'> {}

/**
 * Higher-order component that wraps a component with an ErrorBoundary.
 *
 * @example
 * ```tsx
 * import { withErrorBoundary } from '@universal-logger/core';
 *
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   fallback: <ErrorFallback />,
 *   onError: (error) => console.error(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}
