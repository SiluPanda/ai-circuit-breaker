"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const hourly_1 = require("../window/hourly");
const daily_1 = require("../window/daily");
const monthly_1 = require("../window/monthly");
const custom_1 = require("../window/custom");
const index_1 = require("../window/index");
(0, vitest_1.describe)('HourlyWindow', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    (0, vitest_1.it)('starts at top of the current hour', () => {
        // 2026-03-21T10:35:00.000Z
        const now = Date.UTC(2026, 2, 21, 10, 35, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
    });
    (0, vitest_1.it)('ends at top of the next hour', () => {
        const now = Date.UTC(2026, 2, 21, 10, 35, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-21T11:00:00.000Z');
    });
    (0, vitest_1.it)('mid-hour creation has correct boundaries', () => {
        const now = Date.UTC(2026, 2, 21, 14, 59, 59, 999);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T14:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-21T15:00:00.000Z');
    });
    (0, vitest_1.it)('creation at exactly XX:00:00.000 aligns to that hour', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-21T11:00:00.000Z');
    });
    (0, vitest_1.it)('isExpired returns false before window end', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.isExpired(now + 1_800_000)).toBe(false);
    });
    (0, vitest_1.it)('isExpired returns true after advancing 1 hour', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.isExpired(now + 3_600_000)).toBe(true);
    });
    (0, vitest_1.it)('isExpired returns true at exactly the window end', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.isExpired(now + 3_600_000)).toBe(true);
    });
    (0, vitest_1.it)('reset advances to the new current hour', () => {
        const now = Date.UTC(2026, 2, 21, 10, 30, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        const later = Date.UTC(2026, 2, 21, 12, 15, 0, 0);
        w.reset(later);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T12:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-21T13:00:00.000Z');
    });
    (0, vitest_1.it)('getResetsIn returns correct ms until window end', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getResetsIn(now)).toBe(3_600_000);
        (0, vitest_1.expect)(w.getResetsIn(now + 1_800_000)).toBe(1_800_000);
    });
    (0, vitest_1.it)('getResetsIn returns 0 after window has expired', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new hourly_1.HourlyWindow(now);
        (0, vitest_1.expect)(w.getResetsIn(now + 4_000_000)).toBe(0);
    });
});
(0, vitest_1.describe)('DailyWindow', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    (0, vitest_1.it)('starts at midnight UTC', () => {
        const now = Date.UTC(2026, 2, 21, 14, 30, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T00:00:00.000Z');
    });
    (0, vitest_1.it)('ends at next midnight UTC', () => {
        const now = Date.UTC(2026, 2, 21, 14, 30, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-22T00:00:00.000Z');
    });
    (0, vitest_1.it)('isExpired returns false before 24 hours', () => {
        const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.isExpired(now + 43_200_000)).toBe(false);
    });
    (0, vitest_1.it)('isExpired returns true after 24 hours', () => {
        const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.isExpired(now + 86_400_000)).toBe(true);
    });
    (0, vitest_1.it)('reset advances to the new current day', () => {
        const now = Date.UTC(2026, 2, 21, 14, 0, 0, 0);
        const w = new daily_1.DailyWindow(now);
        const later = Date.UTC(2026, 2, 23, 8, 0, 0, 0);
        w.reset(later);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-23T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-24T00:00:00.000Z');
    });
    (0, vitest_1.it)('getResetsIn returns correct ms from start of day', () => {
        const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.getResetsIn(now)).toBe(86_400_000);
    });
    (0, vitest_1.it)('creation at exactly midnight aligns correctly', () => {
        const now = Date.UTC(2026, 2, 21, 0, 0, 0, 0);
        const w = new daily_1.DailyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-21T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-22T00:00:00.000Z');
    });
});
(0, vitest_1.describe)('MonthlyWindow', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    (0, vitest_1.it)('starts on 1st of the month at midnight UTC', () => {
        const now = Date.UTC(2026, 2, 15, 10, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('ends on 1st of next month', () => {
        const now = Date.UTC(2026, 2, 15, 10, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-04-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('handles February (28 days in non-leap year)', () => {
        // 2027 is not a leap year
        const now = Date.UTC(2027, 1, 10, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2027-02-01T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2027-03-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('handles February (29 days in leap year)', () => {
        // 2028 is a leap year
        const now = Date.UTC(2028, 1, 15, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2028-02-01T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2028-03-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('handles December to January year rollover', () => {
        const now = Date.UTC(2026, 11, 15, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-12-01T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2027-01-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('isExpired returns false mid-month', () => {
        const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.isExpired(Date.UTC(2026, 2, 15, 0, 0, 0, 0))).toBe(false);
    });
    (0, vitest_1.it)('isExpired returns true at start of next month', () => {
        const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.isExpired(Date.UTC(2026, 3, 1, 0, 0, 0, 0))).toBe(true);
    });
    (0, vitest_1.it)('reset advances to the new current month', () => {
        const now = Date.UTC(2026, 2, 15, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        const later = Date.UTC(2026, 5, 10, 0, 0, 0, 0);
        w.reset(later);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-06-01T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-07-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('getResetsIn returns correct ms', () => {
        const start = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(start);
        const end = Date.UTC(2026, 3, 1, 0, 0, 0, 0);
        (0, vitest_1.expect)(w.getResetsIn(start)).toBe(end - start);
    });
    (0, vitest_1.it)('creation on 1st aligns to that month', () => {
        const now = Date.UTC(2026, 2, 1, 0, 0, 0, 0);
        const w = new monthly_1.MonthlyWindow(now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe('2026-03-01T00:00:00.000Z');
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-04-01T00:00:00.000Z');
    });
});
(0, vitest_1.describe)('CustomDurationWindow', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    (0, vitest_1.it)('starts at creation time', () => {
        const now = Date.UTC(2026, 2, 21, 10, 35, 22, 500);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.getWindowStart()).toBe(new Date(now).toISOString());
    });
    (0, vitest_1.it)('15 minute window ends correctly', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.getWindowEnd()).toBe('2026-03-21T10:15:00.000Z');
    });
    (0, vitest_1.it)('isExpired returns false before duration', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.isExpired(now + 450_000)).toBe(false);
    });
    (0, vitest_1.it)('isExpired returns true after duration', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.isExpired(now + 900_000)).toBe(true);
    });
    (0, vitest_1.it)('reset advances by durationMs from the new now', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        const later = now + 1_000_000;
        w.reset(later);
        (0, vitest_1.expect)(w.getWindowStart()).toBe(new Date(later).toISOString());
        (0, vitest_1.expect)(w.getWindowEnd()).toBe(new Date(later + 900_000).toISOString());
    });
    (0, vitest_1.it)('getResetsIn returns correct ms', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.getResetsIn(now)).toBe(900_000);
        (0, vitest_1.expect)(w.getResetsIn(now + 300_000)).toBe(600_000);
    });
    (0, vitest_1.it)('getResetsIn returns 0 after expiration', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(900_000, now);
        (0, vitest_1.expect)(w.getResetsIn(now + 1_000_000)).toBe(0);
    });
    (0, vitest_1.it)('handles 1 second window', () => {
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(1_000, now);
        (0, vitest_1.expect)(w.isExpired(now + 999)).toBe(false);
        (0, vitest_1.expect)(w.isExpired(now + 1_000)).toBe(true);
        (0, vitest_1.expect)(w.getResetsIn(now + 500)).toBe(500);
    });
    (0, vitest_1.it)('handles 1 week window', () => {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const now = Date.UTC(2026, 2, 21, 10, 0, 0, 0);
        const w = new custom_1.CustomDurationWindow(oneWeek, now);
        (0, vitest_1.expect)(w.isExpired(now + oneWeek - 1)).toBe(false);
        (0, vitest_1.expect)(w.isExpired(now + oneWeek)).toBe(true);
        (0, vitest_1.expect)(w.getResetsIn(now)).toBe(oneWeek);
    });
});
(0, vitest_1.describe)('createWindowTracker factory', () => {
    (0, vitest_1.it)('returns HourlyWindow for "hourly"', () => {
        const tracker = (0, index_1.createWindowTracker)('hourly');
        (0, vitest_1.expect)(tracker).toBeInstanceOf(hourly_1.HourlyWindow);
    });
    (0, vitest_1.it)('returns DailyWindow for "daily"', () => {
        const tracker = (0, index_1.createWindowTracker)('daily');
        (0, vitest_1.expect)(tracker).toBeInstanceOf(daily_1.DailyWindow);
    });
    (0, vitest_1.it)('returns MonthlyWindow for "monthly"', () => {
        const tracker = (0, index_1.createWindowTracker)('monthly');
        (0, vitest_1.expect)(tracker).toBeInstanceOf(monthly_1.MonthlyWindow);
    });
    (0, vitest_1.it)('returns CustomDurationWindow for custom window config', () => {
        const tracker = (0, index_1.createWindowTracker)({ type: 'custom', durationMs: 60_000 });
        (0, vitest_1.expect)(tracker).toBeInstanceOf(custom_1.CustomDurationWindow);
    });
    (0, vitest_1.it)('passes now parameter to the tracker', () => {
        const now = Date.UTC(2026, 2, 21, 10, 30, 0, 0);
        const tracker = (0, index_1.createWindowTracker)('hourly', now);
        (0, vitest_1.expect)(tracker.getWindowStart()).toBe('2026-03-21T10:00:00.000Z');
    });
    (0, vitest_1.it)('throws TypeError for invalid window type', () => {
        (0, vitest_1.expect)(() => (0, index_1.createWindowTracker)('weekly')).toThrow(TypeError);
        (0, vitest_1.expect)(() => (0, index_1.createWindowTracker)('weekly')).toThrow('Invalid window type');
    });
});
//# sourceMappingURL=window.test.js.map