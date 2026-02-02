/**
 * Client Reports for tracking dropped events
 *
 * Sentry's client reports feature allows SDKs to report statistics about
 * events that were dropped before being sent to Sentry. This helps with
 * understanding data loss and debugging sampling configurations.
 *
 * @see https://develop.sentry.dev/sdk/client-reports/
 */

export interface ClientReportOutcome {
  /** The reason why the event was dropped */
  reason: 'before_send' | 'event_processor' | 'sample_rate' | 'queue_overflow' | 'ratelimit_backoff' | 'network_error';
  /** The category of the dropped event */
  category: 'error' | 'transaction' | 'session' | 'attachment' | 'profile';
  /** Number of events dropped for this reason/category combination */
  quantity: number;
}

export interface ClientReport {
  timestamp: number;
  discarded_events: ClientReportOutcome[];
}

export type SendReportCallback = (outcomes: ClientReportOutcome[]) => void;

export class ClientReportManager {
  private outcomes: Map<string, number> = new Map();
  private flushInterval: number;
  private timer?: ReturnType<typeof setInterval>;
  private lastFlush: number = Date.now();

  /**
   * Create a new ClientReportManager
   *
   * @param sendReport - Callback function to send the report to Sentry
   * @param flushInterval - How often to flush reports (default: 60 seconds)
   */
  constructor(
    private sendReport: SendReportCallback,
    flushInterval: number = 60000
  ) {
    this.flushInterval = flushInterval;
  }

  /**
   * Record a dropped event outcome
   * O(1) time complexity - just a map update
   *
   * @param reason - Why the event was dropped
   * @param category - What type of event was dropped
   * @param quantity - Number of events (default: 1)
   */
  recordOutcome(
    reason: ClientReportOutcome['reason'],
    category: ClientReportOutcome['category'],
    quantity: number = 1
  ): void {
    const key = `${reason}:${category}`;
    this.outcomes.set(key, (this.outcomes.get(key) || 0) + quantity);
  }

  /**
   * Start automatic periodic flushing of reports
   */
  start(): void {
    if (this.timer) {
      return; // Already started
    }
    this.timer = setInterval(() => this.flush(), this.flushInterval);
    this.lastFlush = Date.now();
  }

  /**
   * Stop automatic periodic flushing
   * Performs a final flush before stopping
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    // Flush any remaining outcomes
    this.flush();
  }

  /**
   * Manually flush accumulated outcomes
   * Call this when shutting down or at strategic points
   */
  flush(): void {
    if (this.outcomes.size === 0) {
      this.lastFlush = Date.now();
      return;
    }

    const outcomes: ClientReportOutcome[] = [];
    for (const [key, quantity] of this.outcomes) {
      const [reason, category] = key.split(':') as [
        ClientReportOutcome['reason'],
        ClientReportOutcome['category']
      ];
      outcomes.push({ reason, category, quantity });
    }

    // Clear outcomes before sending to avoid duplicates
    this.outcomes.clear();
    this.lastFlush = Date.now();

    // Send the report
    try {
      this.sendReport(outcomes);
    } catch (error) {
      // If sending fails, we lose the data - this is acceptable
      // to avoid infinite loops of failure reporting
      console.warn('[ClientReportManager] Failed to send client report:', error);
    }
  }

  /**
   * Get time since last flush in milliseconds
   */
  getTimeSinceLastFlush(): number {
    return Date.now() - this.lastFlush;
  }

  /**
   * Check if the manager is currently running
   */
  isRunning(): boolean {
    return this.timer !== undefined;
  }

  /**
   * Get current pending outcomes count (for debugging/monitoring)
   */
  getPendingCount(): number {
    let count = 0;
    for (const quantity of this.outcomes.values()) {
      count += quantity;
    }
    return count;
  }

  /**
   * Get a snapshot of pending outcomes (for debugging/monitoring)
   */
  getPendingOutcomes(): ClientReportOutcome[] {
    const outcomes: ClientReportOutcome[] = [];
    for (const [key, quantity] of this.outcomes) {
      const [reason, category] = key.split(':') as [
        ClientReportOutcome['reason'],
        ClientReportOutcome['category']
      ];
      outcomes.push({ reason, category, quantity });
    }
    return outcomes;
  }

  /**
   * Update the flush interval
   * Takes effect on the next interval tick
   */
  setFlushInterval(interval: number): void {
    this.flushInterval = interval;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }
}

/**
 * Create a client report envelope item for sending to Sentry
 * This is the format expected by Sentry's envelope endpoint
 */
export function createClientReportEnvelopeItem(
  outcomes: ClientReportOutcome[]
): ClientReport {
  return {
    timestamp: Date.now() / 1000, // Unix timestamp in seconds
    discarded_events: outcomes
  };
}
