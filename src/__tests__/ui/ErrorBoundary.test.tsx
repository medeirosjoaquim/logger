/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '../../ui/components/ErrorBoundary';
import { UniversalLogger } from '../../core/logger';

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

// Suppress console.error for expected errors
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(async () => {
    UniversalLogger.resetInstance();
    const logger = UniversalLogger.getInstance();
    await logger.init({
      _experiments: { storage: 'memory' },
    });
  });

  afterEach(async () => {
    await UniversalLogger.getInstance().close();
    UniversalLogger.resetInstance();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeDefined();
  });

  it('renders default fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('Test error')).toBeDefined();
    expect(screen.getByText('Try again')).toBeDefined();
  });

  it('renders custom fallback element', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeDefined();
  });

  it('renders fallback function with error details', () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetError }) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={resetError}>Reset</button>
          </div>
        )}
      >
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error: Test error')).toBeDefined();
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('calls onError callback when error occurs', async () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    // Wait for async error capture (the capture is async)
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled();
    }, { timeout: 500 });

    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Test error');
  });

  it('resets error state when resetError is called', async () => {
    let resetFn: () => void;

    const { rerender } = render(
      <ErrorBoundary
        fallback={({ resetError }) => {
          resetFn = resetError;
          return <button onClick={resetError}>Reset</button>;
        }}
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Reset')).toBeDefined();

    // Rerender with non-throwing component and trigger reset
    rerender(
      <ErrorBoundary
        fallback={({ resetError }) => {
          resetFn = resetError;
          return <button onClick={resetError}>Reset</button>;
        }}
      >
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // Click reset
    fireEvent.click(screen.getByText('Reset'));

    // Should now show the non-error content
    expect(screen.getByText('No error')).toBeDefined();
  });

  it('calls onReset callback when reset', () => {
    const onReset = vi.fn();

    const { rerender } = render(
      <ErrorBoundary
        onReset={onReset}
        fallback={({ resetError }) => <button onClick={resetError}>Reset</button>}
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary
        onReset={onReset}
        fallback={({ resetError }) => <button onClick={resetError}>Reset</button>}
      >
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reset'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('withErrorBoundary', () => {
  beforeEach(async () => {
    UniversalLogger.resetInstance();
    const logger = UniversalLogger.getInstance();
    await logger.init({
      _experiments: { storage: 'memory' },
    });
  });

  afterEach(async () => {
    await UniversalLogger.getInstance().close();
    UniversalLogger.resetInstance();
  });

  it('wraps component with ErrorBoundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowError, {
      fallback: <div>HOC fallback</div>,
    });

    render(<WrappedComponent />);

    expect(screen.getByText('HOC fallback')).toBeDefined();
  });

  it('passes props to wrapped component', () => {
    function DisplayProps({ name }: { name: string }) {
      return <div>Hello {name}</div>;
    }

    const WrappedComponent = withErrorBoundary(DisplayProps);

    render(<WrappedComponent name="World" />);

    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('sets displayName correctly', () => {
    function MyComponent() {
      return <div>Test</div>;
    }

    const WrappedComponent = withErrorBoundary(MyComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(MyComponent)');
  });
});

describe('ErrorBoundary exports', () => {
  it('is exported from ui component module', () => {
    // Direct import from component file
    expect(ErrorBoundary).toBeDefined();
    expect(withErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary).toBe('function');
    expect(typeof withErrorBoundary).toBe('function');
  });

  it('ErrorBoundary has correct displayName', () => {
    expect(ErrorBoundary.displayName).toBe('ErrorBoundary');
  });
});
