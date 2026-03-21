import type { WindowTracker } from './types';

export class MonthlyWindow implements WindowTracker {
  private windowStart: number;
  private windowEnd: number;

  constructor(now: number = Date.now()) {
    this.windowStart = MonthlyWindow.computeStart(now);
    this.windowEnd = MonthlyWindow.computeNextMonth(this.windowStart);
  }

  getWindowStart(): string {
    return new Date(this.windowStart).toISOString();
  }

  getWindowEnd(): string {
    return new Date(this.windowEnd).toISOString();
  }

  isExpired(now: number = Date.now()): boolean {
    return now >= this.windowEnd;
  }

  reset(now: number = Date.now()): void {
    this.windowStart = MonthlyWindow.computeStart(now);
    this.windowEnd = MonthlyWindow.computeNextMonth(this.windowStart);
  }

  getResetsIn(now: number = Date.now()): number {
    return Math.max(0, this.windowEnd - now);
  }

  private static computeStart(ts: number): number {
    const d = new Date(ts);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }

  private static computeNextMonth(startTs: number): number {
    const d = new Date(startTs);
    const month = d.getUTCMonth();
    const year = d.getUTCFullYear();
    if (month === 11) {
      d.setUTCFullYear(year + 1);
      d.setUTCMonth(0);
    } else {
      d.setUTCMonth(month + 1);
    }
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
}
