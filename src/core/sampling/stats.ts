/**
 * Sampling statistics tracking for monitoring and debugging
 * All operations are O(1) with fixed memory footprint
 */

export interface SamplingStatsData {
  error: CategoryStats;
  transaction: CategoryStats;
  totalDropped: number;
  totalSampled: number;
}

export interface CategoryStats {
  total: number;
  sampled: number;
  dropped: number;
  byReason: Record<string, { sampled: number; dropped: number }>;
}

export class SamplingStats {
  private data: SamplingStatsData = {
    error: this.createCategory(),
    transaction: this.createCategory(),
    totalDropped: 0,
    totalSampled: 0
  };

  /**
   * Create a fresh category stats object
   */
  private createCategory(): CategoryStats {
    return { total: 0, sampled: 0, dropped: 0, byReason: {} };
  }

  /**
   * Record a sampling decision
   * O(1) time complexity - just counter increments
   *
   * @param category - The type of event (error or transaction)
   * @param sampled - Whether the event was sampled (true) or dropped (false)
   * @param reason - The reason for the sampling decision (rate, inherited, sampler)
   */
  record(
    category: 'error' | 'transaction',
    sampled: boolean,
    reason: string = 'rate'
  ): void {
    const cat = this.data[category];
    cat.total++;

    if (sampled) {
      cat.sampled++;
      this.data.totalSampled++;
    } else {
      cat.dropped++;
      this.data.totalDropped++;
    }

    // Track by reason - limited set of reasons keeps memory bounded
    if (!cat.byReason[reason]) {
      cat.byReason[reason] = { sampled: 0, dropped: 0 };
    }
    cat.byReason[reason][sampled ? 'sampled' : 'dropped']++;
  }

  /**
   * Get a shallow copy of the stats data
   * Safe to use without affecting internal state
   */
  getData(): SamplingStatsData {
    return {
      error: { ...this.data.error, byReason: { ...this.data.error.byReason } },
      transaction: { ...this.data.transaction, byReason: { ...this.data.transaction.byReason } },
      totalDropped: this.data.totalDropped,
      totalSampled: this.data.totalSampled
    };
  }

  /**
   * Reset all statistics to zero
   * Useful for periodic reporting or testing
   */
  reset(): void {
    this.data = {
      error: this.createCategory(),
      transaction: this.createCategory(),
      totalDropped: 0,
      totalSampled: 0
    };
  }

  /**
   * Calculate the effective sample rate for a category
   *
   * @param category - The category to calculate rate for
   * @returns The ratio of sampled to total (0-1), or 0 if no samples
   */
  getSampleRate(category: 'error' | 'transaction'): number {
    const cat = this.data[category];
    if (cat.total === 0) return 0;
    return cat.sampled / cat.total;
  }

  /**
   * Get the drop rate for a category
   *
   * @param category - The category to calculate rate for
   * @returns The ratio of dropped to total (0-1), or 0 if no samples
   */
  getDropRate(category: 'error' | 'transaction'): number {
    const cat = this.data[category];
    if (cat.total === 0) return 0;
    return cat.dropped / cat.total;
  }

  /**
   * Get total event count across all categories
   */
  getTotalEvents(): number {
    return this.data.error.total + this.data.transaction.total;
  }

  /**
   * Get overall sample rate across all categories
   */
  getOverallSampleRate(): number {
    const total = this.getTotalEvents();
    if (total === 0) return 0;
    return this.data.totalSampled / total;
  }
}
