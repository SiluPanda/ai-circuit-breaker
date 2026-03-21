import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HourlyWindow } from '../window/hourly';
import { DailyWindow } from '../window/daily';
import { MonthlyWindow } from '../window/monthly';
import { CustomDurationWindow } from '../window/custom';
import { createWindowTracker } from '../window/index';

describe('HourlyWindow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts at top of the current hour', () => {
    // 2026-03-21T10:35:00.000Z
    const now = Date.UTC(2026, 2, 21, 10, 35, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
  });

  it('ends at top of the next hour', () => {
    const now = Date.UTC(2026, 2, 21, 10, 35, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.getWindowEnd()).toBe('2026-03-21T11:00:00.000Z');
  });

  it('mid-hour creation has correct boundaries', () => {
    const now = Date.UTC(2026, 2, 21, 14, 59, 59, 999);
    const w = new HourlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-21T14:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-03-21T15:00:00.000Z');
  });

  it('creation at exactly XX:00:00.000 aligns to that hour', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-03-21T11:00:00.000Z');
  });

  it('isExpired returns false before window end', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.isExpired(now + 1_800_000)).toBe(false);
  });

  it('isExpired returns true after advancing 1 hour', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.isExpired(now + 3_600_000)).toBe(true);
  });

  it('isExpired returns true at exactly the window end', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.isExpired(now + 3_600_000)).toBe(true);
  });

  it('reset advances to the new current hour', () => {
    const now = Date.UTC(2026, 2, 21, 10, 30, 0, 0);
    const w = new HourlyWindow(now);
    const later = Date.UTC(2026, 2, 21, 12, 15, 0, 0);
    w.reset(later);
    expect(w.getWindowStart()).toBe('2026-03-21T12:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-03-21T13:00:00.000Z');
  });

  it('getResetsIn returns correct ms until window end', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.getResetsIn(now)).toBe(3_600_000);
    expect(w.getResetsIn(now + 1_800_000)).toBe(1_800_000);
  });

  it('getResetsIn returns 0 after window has expired', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new HourlyWindow(now);
    expect(w.getResetsIn(now + 4_000_000)).toBe(0);
  });
});

describe('DailyWindow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts at midnight UTC', () => {
    const now = Date.UTC(2026, 2, 21, 14, 30, 0, 0);
    const w = new DailyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-21T00:00:00.000Z');
  });

  it('ends at next midnight UTC', () => {
    const now = Date.UTC(2026, 2, 21, 14, 30, 0, 0);
    const w = new DailyWindow(now);
    expect(w.getWindowEnd()).toBe('2026-03-22T00:00:00.000Z');
  });

  it('isExpired returns false before 24 hours', () => {
    const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
    const w = new DailyWindow(now);
    expect(w.isExpired(now + 43_200_000)).toBe(false);
  });

  it('isExpired returns true after 24 hours', () => {
    const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
    const w = new DailyWindow(now);
    expect(w.isExpired(now + 86_400_000)).toBe(true);
  });

  it('reset advances to the new current day', () => {
    const now = Date.UTC(2026, 2, 21, 14, 0, 0, 0);
    const w = new DailyWindow(now);
    const later = Date.UTC(2026, 2, 23, 8, 0, 0, 0);
    w.reset(later);
    expect(w.getWindowStart()).toBe('2026-03-23T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-03-24T00:00:00.000Z');
  });

  it('getResetsIn returns correct ms from start of day', () => {
    const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
    const w = new DailyWindow(now);
    expect(w.getResetsIn(now)).toBe(86_400_000);
  });

  it('creation at exactly midnight aligns correctly', () => {
    const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
    const w = new DailyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-21T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-03-22T00:00:00.000Z');
  });
});

describe('MonthlyWindow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts on 1st of the month at midnight UTC', () => {
    const now = Date.UTC(2026, 2, 15, 10, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('ends on 1st of next month', () => {
    const now = Date.UTC(2026, 2, 15, 10, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowEnd()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('handles February (28 days in non-leap year)', () => {
    // 2027 is not a leap year
    const now = Date.UTC(2027, 1, 10, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowStart()).toBe('2027-02-01T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2027-03-01T00:00:00.000Z');
  });

  it('handles February (29 days in leap year)', () => {
    // 2028 is a leap year
    const now = Date.UTC(2028, 1, 15, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowStart()).toBe('2028-02-01T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2028-03-01T00:00:00.000Z');
  });

  it('handles December to January year rollover', () => {
    const now = Date.UTC(2026, 11, 15, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-12-01T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('isExpired returns false mid-month', () => {
    const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.isExpired(Date.UTC(2026, 2, 15, 0, 0, 0, 0))).toBe(false);
  });

  it('isExpired returns true at start of next month', () => {
    const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.isExpired(Date.UTC(2026, 3, 1, 0, 0, 0, 0))).toBe(true);
  });

  it('reset advances to the new current month', () => {
    const now = Date.UTC(2026, 2, 15, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    const later = Date.UTC(2026, 5, 10, 0, 0, 0, 0);
    w.reset(later);
    expect(w.getWindowStart()).toBe('2026-06-01T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('getResetsIn returns correct ms', () => {
    const start = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
    const w = new MonthlyWindow(start);
    const end = Date.UTC(2026, 3, 1, 0, 0, 0, 0);
    expect(w.getResetsIn(start)).toBe(end - start);
  });

  it('creation on 1st aligns to that month', () => {
    const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
    const w = new MonthlyWindow(now);
    expect(w.getWindowStart()).toBe('2026-03-01T00:00:00.000Z');
    expect(w.getWindowEnd()).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('CustomDurationWindow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts at creation time', () => {
    const now = Date.UTC(2026, 2, 21, 10, 35, 22, 500);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.getWindowStart()).toBe(new Date(now).toISOString());
  });

  it('15 minute window ends correctly', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.getWindowEnd()).toBe('2026-03-21T10:15:00.000Z');
  });

  it('isExpired returns false before duration', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.isExpired(now + 450_000)).toBe(false);
  });

  it('isExpired returns true after duration', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.isExpired(now + 900_000)).toBe(true);
  });

  it('reset advances by durationMs from the new now', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    const later = now + 1_000_000;
    w.reset(later);
    expect(w.getWindowStart()).toBe(new Date(later).toISOString());
    expect(w.getWindowEnd()).toBe(new Date(later + 900_000).toISOString());
  });

  it('getResetsIn returns correct ms', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.getResetsIn(now)).toBe(900_000);
    expect(w.getResetsIn(now + 300_000)).toBe(600_000);
  });

  it('getResetsIn returns 0 after expiration', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(900_000, now);
    expect(w.getResetsIn(now + 1_000_000)).toBe(0);
  });

  it('handles 1 second window', () => {
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(1_000, now);
    expect(w.isExpired(now + 999)).toBe(false);
    expect(w.isExpired(now + 1_000)).toBe(true);
    expect(w.getResetsIn(now + 500)).toBe(500);
  });

  it('handles 1 week window', () => {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
    const w = new CustomDurationWindow(oneWeek, now);
    expect(w.isExpired(now + oneWeek - 1)).toBe(false);
    expect(w.isExpired(now + oneWeek)).toBe(true);
    expect(w.getResetsIn(now)).toBe(oneWeek);
  });
});

describe('createWindowTracker factory', () => {
  it('returns HourlyWindow for "hourly"', () => {
    const tracker = createWindowTracker('hourly');
    expect(tracker).toBeInstanceOf(HourlyWindow);
  });

  it('returns DailyWindow for "daily"', () => {
    const tracker = createWindowTracker('daily');
    expect(tracker).toBeInstanceOf(DailyWindow);
  });

  it('returns MonthlyWindow for "monthly"', () => {
    const tracker = createWindowTracker('monthly');
    expect(tracker).toBeInstanceOf(MonthlyWindow);
  });

  it('returns CustomDurationWindow for custom window config', () => {
    const tracker = createWindowTracker({ type: 'custom', durationMs: 60_000 });
    expect(tracker).toBeInstanceOf(CustomDurationWindow);
  });

  it('passes now parameter to the tracker', () => {
    const now = Date.UTC(2026, 2, 21, 10, 30, 0, 0);
    const tracker = createWindowTracker('hourly', now);
    expect(tracker.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
  });

  it('throws TypeError for invalid window type', () => {
    expect(() => createWindowTracker('weekly' as never)).toThrow(TypeError);
    expect(() => createWindowTracker('weekly' as never)).toThrow('Invalid window type');
  });
});
