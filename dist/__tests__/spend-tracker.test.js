"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const spend_tracker_1 = require("../spend-tracker");
(0, vitest_1.describe)('SpendTracker', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    (0, vitest_1.describe)('addSpend accumulation', () => {
        (0, vitest_1.it)('accumulates a single spend', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(25);
            (0, vitest_1.expect)(tracker.getSpent()).toBe(25);
        });
        (0, vitest_1.it)('accumulates multiple spends', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(10);
            tracker.addSpend(20);
            tracker.addSpend(30);
            (0, vitest_1.expect)(tracker.getSpent()).toBe(60);
        });
        (0, vitest_1.it)('accumulates fractional costs correctly', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(0.1);
            tracker.addSpend(0.2);
            // Floating point: 0.1 + 0.2 = 0.30000000000000004
            (0, vitest_1.expect)(tracker.getSpent()).toBeCloseTo(0.3, 10);
        });
    });
    (0, vitest_1.describe)('threshold breach detection', () => {
        (0, vitest_1.it)('is not breached when under limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const result = tracker.addSpend(50);
            (0, vitest_1.expect)(result.breached).toBe(false);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
        });
        (0, vitest_1.it)('is breached at exactly the limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const result = tracker.addSpend(100);
            (0, vitest_1.expect)(result.breached).toBe(true);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(true);
        });
        (0, vitest_1.it)('is breached when over the limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const result = tracker.addSpend(150);
            (0, vitest_1.expect)(result.breached).toBe(true);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(true);
        });
        (0, vitest_1.it)('transitions to breached after multiple spends', () => {
            const tracker = new spend_tracker_1.SpendTracker(50);
            tracker.addSpend(20);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
            tracker.addSpend(20);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
            const result = tracker.addSpend(15);
            (0, vitest_1.expect)(result.breached).toBe(true);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(true);
        });
    });
    (0, vitest_1.describe)('warning threshold', () => {
        (0, vitest_1.it)('fires at default 80% threshold', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const r1 = tracker.addSpend(79);
            (0, vitest_1.expect)(r1.warningCrossed).toBe(false);
            const r2 = tracker.addSpend(1);
            (0, vitest_1.expect)(r2.warningCrossed).toBe(true);
        });
        (0, vitest_1.it)('fires only once per window', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(80);
            (0, vitest_1.expect)(tracker.isWarningFired()).toBe(true);
            const r2 = tracker.addSpend(10);
            (0, vitest_1.expect)(r2.warningCrossed).toBe(false);
        });
        (0, vitest_1.it)('fires with custom warningThreshold', () => {
            const tracker = new spend_tracker_1.SpendTracker(100, 0.5);
            const r1 = tracker.addSpend(49);
            (0, vitest_1.expect)(r1.warningCrossed).toBe(false);
            const r2 = tracker.addSpend(1);
            (0, vitest_1.expect)(r2.warningCrossed).toBe(true);
        });
        (0, vitest_1.it)('does not fire when limit is zero', () => {
            const tracker = new spend_tracker_1.SpendTracker(0, 0.8);
            // With limit=0, the condition `this.limit > 0` prevents warning
            const r = tracker.addSpend(5);
            (0, vitest_1.expect)(r.warningCrossed).toBe(false);
        });
        (0, vitest_1.it)('fires at exactly the threshold ratio', () => {
            const tracker = new spend_tracker_1.SpendTracker(100, 0.8);
            const r = tracker.addSpend(80);
            (0, vitest_1.expect)(r.warningCrossed).toBe(true);
        });
    });
    (0, vitest_1.describe)('history tracking', () => {
        (0, vitest_1.it)('adds entries with cost and timestamp', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(25);
            const history = tracker.getHistory();
            (0, vitest_1.expect)(history).toHaveLength(1);
            (0, vitest_1.expect)(history[0].cost).toBe(25);
            (0, vitest_1.expect)(history[0].timestamp).toBe('2026-03-21T10:00:00.000Z');
        });
        (0, vitest_1.it)('adds multiple entries in order', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(10);
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:01:00.000Z'));
            tracker.addSpend(20);
            const history = tracker.getHistory();
            (0, vitest_1.expect)(history).toHaveLength(2);
            (0, vitest_1.expect)(history[0].cost).toBe(10);
            (0, vitest_1.expect)(history[0].timestamp).toBe('2026-03-21T10:00:00.000Z');
            (0, vitest_1.expect)(history[1].cost).toBe(20);
            (0, vitest_1.expect)(history[1].timestamp).toBe('2026-03-21T10:01:00.000Z');
        });
        (0, vitest_1.it)('returns a defensive copy of history', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(10);
            const h1 = tracker.getHistory();
            h1.push({ cost: 999, timestamp: 'fake' });
            (0, vitest_1.expect)(tracker.getHistory()).toHaveLength(1);
        });
    });
    (0, vitest_1.describe)('maxHistorySize', () => {
        (0, vitest_1.it)('respects default maxHistorySize of 1000', () => {
            const tracker = new spend_tracker_1.SpendTracker(1_000_000);
            for (let i = 0; i < 1005; i++) {
                tracker.addSpend(1);
            }
            (0, vitest_1.expect)(tracker.getHistory()).toHaveLength(1000);
        });
        (0, vitest_1.it)('evicts oldest entries when over max', () => {
            const tracker = new spend_tracker_1.SpendTracker(100, 0.8, 3);
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            tracker.addSpend(1);
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:01:00.000Z'));
            tracker.addSpend(2);
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:02:00.000Z'));
            tracker.addSpend(3);
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:03:00.000Z'));
            tracker.addSpend(4);
            const history = tracker.getHistory();
            (0, vitest_1.expect)(history).toHaveLength(3);
            (0, vitest_1.expect)(history[0].cost).toBe(2);
            (0, vitest_1.expect)(history[1].cost).toBe(3);
            (0, vitest_1.expect)(history[2].cost).toBe(4);
        });
        (0, vitest_1.it)('custom maxHistorySize of 1', () => {
            const tracker = new spend_tracker_1.SpendTracker(100, 0.8, 1);
            tracker.addSpend(5);
            tracker.addSpend(10);
            tracker.addSpend(15);
            const history = tracker.getHistory();
            (0, vitest_1.expect)(history).toHaveLength(1);
            (0, vitest_1.expect)(history[0].cost).toBe(15);
        });
    });
    (0, vitest_1.describe)('reset', () => {
        (0, vitest_1.it)('clears spent', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(50);
            tracker.reset();
            (0, vitest_1.expect)(tracker.getSpent()).toBe(0);
        });
        (0, vitest_1.it)('clears breached flag', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(150);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(true);
            tracker.reset();
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
        });
        (0, vitest_1.it)('clears warningFired flag', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(90);
            (0, vitest_1.expect)(tracker.isWarningFired()).toBe(true);
            tracker.reset();
            (0, vitest_1.expect)(tracker.isWarningFired()).toBe(false);
        });
        (0, vitest_1.it)('clears history', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(10);
            tracker.addSpend(20);
            tracker.reset();
            (0, vitest_1.expect)(tracker.getHistory()).toHaveLength(0);
        });
        (0, vitest_1.it)('allows re-accumulation after reset', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(80);
            tracker.reset();
            tracker.addSpend(30);
            (0, vitest_1.expect)(tracker.getSpent()).toBe(30);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
        });
        (0, vitest_1.it)('allows warning to fire again after reset', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const r1 = tracker.addSpend(80);
            (0, vitest_1.expect)(r1.warningCrossed).toBe(true);
            tracker.reset();
            const r2 = tracker.addSpend(80);
            (0, vitest_1.expect)(r2.warningCrossed).toBe(true);
        });
    });
    (0, vitest_1.describe)('addSpend(0) no-op', () => {
        (0, vitest_1.it)('does not add a history entry', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(0);
            (0, vitest_1.expect)(tracker.getHistory()).toHaveLength(0);
        });
        (0, vitest_1.it)('does not change spent', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(50);
            tracker.addSpend(0);
            (0, vitest_1.expect)(tracker.getSpent()).toBe(50);
        });
        (0, vitest_1.it)('returns current breached state without change', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(100);
            const result = tracker.addSpend(0);
            (0, vitest_1.expect)(result.breached).toBe(true);
            (0, vitest_1.expect)(result.warningCrossed).toBe(false);
        });
        (0, vitest_1.it)('does not trigger warning', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            const result = tracker.addSpend(0);
            (0, vitest_1.expect)(result.warningCrossed).toBe(false);
        });
    });
    (0, vitest_1.describe)('negative cost', () => {
        (0, vitest_1.it)('throws TypeError for negative cost', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            (0, vitest_1.expect)(() => tracker.addSpend(-1)).toThrow(TypeError);
        });
        (0, vitest_1.it)('throws with correct message', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            (0, vitest_1.expect)(() => tracker.addSpend(-0.01)).toThrow('cost must be non-negative');
        });
    });
    (0, vitest_1.describe)('getRemaining', () => {
        (0, vitest_1.it)('returns full limit when no spend', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(100);
        });
        (0, vitest_1.it)('returns correct remaining after spend', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(30);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(70);
        });
        (0, vitest_1.it)('clamps to 0 when over limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(150);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(0);
        });
        (0, vitest_1.it)('returns 0 at exactly the limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(100);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(0);
        });
    });
    (0, vitest_1.describe)('setLimit', () => {
        (0, vitest_1.it)('updates the limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.setLimit(200);
            (0, vitest_1.expect)(tracker.getLimit()).toBe(200);
        });
        (0, vitest_1.it)('affects remaining calculation', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(80);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(20);
            tracker.setLimit(200);
            (0, vitest_1.expect)(tracker.getRemaining()).toBe(120);
        });
        (0, vitest_1.it)('can un-breach when limit is increased', () => {
            const tracker = new spend_tracker_1.SpendTracker(100);
            tracker.addSpend(100);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(true);
            tracker.setLimit(200);
            (0, vitest_1.expect)(tracker.isBreached()).toBe(false);
        });
    });
    (0, vitest_1.describe)('getLimit', () => {
        (0, vitest_1.it)('returns the configured limit', () => {
            const tracker = new spend_tracker_1.SpendTracker(42);
            (0, vitest_1.expect)(tracker.getLimit()).toBe(42);
        });
    });
});
//# sourceMappingURL=spend-tracker.test.js.map