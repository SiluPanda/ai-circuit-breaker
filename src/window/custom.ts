import type { WindowTracker } from './types';

export class CustomDurationWindow implements WindowTracker {
  private windowStart: number;
  private windowEnd: number;

  constructor(
    private readonly durationMs: number,
    now: number = Date.now(),
  ) {
    this.windowStart = now;
    this.windowEnd = this.windowStart + this.durationMs;
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
    this.windowStart = now;
    this.windowEnd = this.windowStart + this.durationMs;
  }

  getResetsIn(now: number = Date.now()): number {
    return Math.max(0, this.windowEnd - now);
  }
}
