import type { SpendEntry } from './types';

export class SpendTracker {
  private spent = 0;
  private breached = false;
  private warningFired = false;
  private history: SpendEntry[] = [];

  constructor(
    private limit: number,
    private readonly warningThreshold: number = 0.8,
    private readonly maxHistorySize: number = 1000,
  ) {}

  addSpend(cost: number): { breached: boolean; warningCrossed: boolean } {
    if (cost < 0) throw new TypeError('cost must be non-negative');
    if (cost === 0) return { breached: this.breached, warningCrossed: false };

    this.spent += cost;
    this.history.push({ cost, timestamp: new Date().toISOString() });

    // Evict oldest if over max
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.breached = this.spent >= this.limit;

    let warningCrossed = false;
    if (!this.warningFired && this.limit > 0 && (this.spent / this.limit) >= this.warningThreshold) {
      this.warningFired = true;
      warningCrossed = true;
    }

    return { breached: this.breached, warningCrossed };
  }

  getSpent(): number { return this.spent; }
  getLimit(): number { return this.limit; }
  setLimit(limit: number): void {
    this.limit = limit;
    this.breached = this.spent >= this.limit;
  }
  getRemaining(): number { return Math.max(0, this.limit - this.spent); }
  isBreached(): boolean { return this.breached; }
  isWarningFired(): boolean { return this.warningFired; }
  getHistory(): SpendEntry[] { return [...this.history]; }

  reset(): void {
    this.spent = 0;
    this.breached = false;
    this.warningFired = false;
    this.history = [];
  }
}
