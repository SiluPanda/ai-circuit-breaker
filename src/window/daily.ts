import type { WindowTracker } from './types';

export class DailyWindow implements WindowTracker {
  private windowStart: number;
  private windowEnd: number;

  constructor(now: number = Date.now()) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    this.windowStart = d.getTime();
    this.windowEnd = this.windowStart + 86_400_000;
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
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    this.windowStart = d.getTime();
    this.windowEnd = this.windowStart + 86_400_000;
  }

  getResetsIn(now: number = Date.now()): number {
    return Math.max(0, this.windowEnd - now);
  }
}
