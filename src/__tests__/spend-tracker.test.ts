import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpendTracker } from '../spend-tracker';

describe('SpendTracker', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('addSpend accumulation', () => {
    it('accumulates a single spend', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(25);
      expect(tracker.getSpent()).toBe(25);
    });

    it('accumulates multiple spends', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(10);
      tracker.addSpend(20);
      tracker.addSpend(30);
      expect(tracker.getSpent()).toBe(60);
    });

    it('accumulates fractional costs correctly', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(0.1);
      tracker.addSpend(0.2);
      // Floating point: 0.1 + 0.2 = 0.30000000000000004
      expect(tracker.getSpent()).toBeCloseTo(0.3, 10);
    });
  });

  describe('threshold breach detection', () => {
    it('is not breached when under limit', () => {
      const tracker = new SpendTracker(100);
      const result = tracker.addSpend(50);
      expect(result.breached).toBe(false);
      expect(tracker.isBreached()).toBe(false);
    });

    it('is breached at exactly the limit', () => {
      const tracker = new SpendTracker(100);
      const result = tracker.addSpend(100);
      expect(result.breached).toBe(true);
      expect(tracker.isBreached()).toBe(true);
    });

    it('is breached when over the limit', () => {
      const tracker = new SpendTracker(100);
      const result = tracker.addSpend(150);
      expect(result.breached).toBe(true);
      expect(tracker.isBreached()).toBe(true);
    });

    it('transitions to breached after multiple spends', () => {
      const tracker = new SpendTracker(50);
      tracker.addSpend(20);
      expect(tracker.isBreached()).toBe(false);
      tracker.addSpend(20);
      expect(tracker.isBreached()).toBe(false);
      const result = tracker.addSpend(15);
      expect(result.breached).toBe(true);
      expect(tracker.isBreached()).toBe(true);
    });
  });

  describe('warning threshold', () => {
    it('fires at default 80% threshold', () => {
      const tracker = new SpendTracker(100);
      const r1 = tracker.addSpend(79);
      expect(r1.warningCrossed).toBe(false);
      const r2 = tracker.addSpend(1);
      expect(r2.warningCrossed).toBe(true);
    });

    it('fires only once per window', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(80);
      expect(tracker.isWarningFired()).toBe(true);
      const r2 = tracker.addSpend(10);
      expect(r2.warningCrossed).toBe(false);
    });

    it('fires with custom warningThreshold', () => {
      const tracker = new SpendTracker(100, 0.5);
      const r1 = tracker.addSpend(49);
      expect(r1.warningCrossed).toBe(false);
      const r2 = tracker.addSpend(1);
      expect(r2.warningCrossed).toBe(true);
    });

    it('does not fire when limit is zero', () => {
      const tracker = new SpendTracker(0, 0.8);
      // With limit=0, the condition `this.limit > 0` prevents warning
      const r = tracker.addSpend(5);
      expect(r.warningCrossed).toBe(false);
    });

    it('fires at exactly the threshold ratio', () => {
      const tracker = new SpendTracker(100, 0.8);
      const r = tracker.addSpend(80);
      expect(r.warningCrossed).toBe(true);
    });
  });

  describe('history tracking', () => {
    it('adds entries with cost and timestamp', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const tracker = new SpendTracker(100);
      tracker.addSpend(25);
      const history = tracker.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].cost).toBe(25);
      expect(history[0].timestamp).toBe('2026-03-21T10:00:00.000Z');
    });

    it('adds multiple entries in order', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const tracker = new SpendTracker(100);
      tracker.addSpend(10);
      vi.setSystemTime(new Date('2026-03-21T10:01:00.000Z'));
      tracker.addSpend(20);
      const history = tracker.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].cost).toBe(10);
      expect(history[0].timestamp).toBe('2026-03-21T10:00:00.000Z');
      expect(history[1].cost).toBe(20);
      expect(history[1].timestamp).toBe('2026-03-21T10:01:00.000Z');
    });

    it('returns a defensive copy of history', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(10);
      const h1 = tracker.getHistory();
      h1.push({ cost: 999, timestamp: 'fake' });
      expect(tracker.getHistory()).toHaveLength(1);
    });
  });

  describe('maxHistorySize', () => {
    it('respects default maxHistorySize of 1000', () => {
      const tracker = new SpendTracker(1_000_000);
      for (let i = 0; i < 1005; i++) {
        tracker.addSpend(1);
      }
      expect(tracker.getHistory()).toHaveLength(1000);
    });

    it('evicts oldest entries when over max', () => {
      const tracker = new SpendTracker(100, 0.8, 3);
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      tracker.addSpend(1);
      vi.setSystemTime(new Date('2026-03-21T10:01:00.000Z'));
      tracker.addSpend(2);
      vi.setSystemTime(new Date('2026-03-21T10:02:00.000Z'));
      tracker.addSpend(3);
      vi.setSystemTime(new Date('2026-03-21T10:03:00.000Z'));
      tracker.addSpend(4);
      const history = tracker.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].cost).toBe(2);
      expect(history[1].cost).toBe(3);
      expect(history[2].cost).toBe(4);
    });

    it('custom maxHistorySize of 1', () => {
      const tracker = new SpendTracker(100, 0.8, 1);
      tracker.addSpend(5);
      tracker.addSpend(10);
      tracker.addSpend(15);
      const history = tracker.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].cost).toBe(15);
    });
  });

  describe('reset', () => {
    it('clears spent', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(50);
      tracker.reset();
      expect(tracker.getSpent()).toBe(0);
    });

    it('clears breached flag', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(150);
      expect(tracker.isBreached()).toBe(true);
      tracker.reset();
      expect(tracker.isBreached()).toBe(false);
    });

    it('clears warningFired flag', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(90);
      expect(tracker.isWarningFired()).toBe(true);
      tracker.reset();
      expect(tracker.isWarningFired()).toBe(false);
    });

    it('clears history', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(10);
      tracker.addSpend(20);
      tracker.reset();
      expect(tracker.getHistory()).toHaveLength(0);
    });

    it('allows re-accumulation after reset', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(80);
      tracker.reset();
      tracker.addSpend(30);
      expect(tracker.getSpent()).toBe(30);
      expect(tracker.isBreached()).toBe(false);
    });

    it('allows warning to fire again after reset', () => {
      const tracker = new SpendTracker(100);
      const r1 = tracker.addSpend(80);
      expect(r1.warningCrossed).toBe(true);
      tracker.reset();
      const r2 = tracker.addSpend(80);
      expect(r2.warningCrossed).toBe(true);
    });
  });

  describe('addSpend(0) no-op', () => {
    it('does not add a history entry', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(0);
      expect(tracker.getHistory()).toHaveLength(0);
    });

    it('does not change spent', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(50);
      tracker.addSpend(0);
      expect(tracker.getSpent()).toBe(50);
    });

    it('returns current breached state without change', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(100);
      const result = tracker.addSpend(0);
      expect(result.breached).toBe(true);
      expect(result.warningCrossed).toBe(false);
    });

    it('does not trigger warning', () => {
      const tracker = new SpendTracker(100);
      const result = tracker.addSpend(0);
      expect(result.warningCrossed).toBe(false);
    });
  });

  describe('negative cost', () => {
    it('throws TypeError for negative cost', () => {
      const tracker = new SpendTracker(100);
      expect(() => tracker.addSpend(-1)).toThrow(TypeError);
    });

    it('throws with correct message', () => {
      const tracker = new SpendTracker(100);
      expect(() => tracker.addSpend(-0.01)).toThrow('cost must be non-negative');
    });
  });

  describe('getRemaining', () => {
    it('returns full limit when no spend', () => {
      const tracker = new SpendTracker(100);
      expect(tracker.getRemaining()).toBe(100);
    });

    it('returns correct remaining after spend', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(30);
      expect(tracker.getRemaining()).toBe(70);
    });

    it('clamps to 0 when over limit', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(150);
      expect(tracker.getRemaining()).toBe(0);
    });

    it('returns 0 at exactly the limit', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(100);
      expect(tracker.getRemaining()).toBe(0);
    });
  });

  describe('setLimit', () => {
    it('updates the limit', () => {
      const tracker = new SpendTracker(100);
      tracker.setLimit(200);
      expect(tracker.getLimit()).toBe(200);
    });

    it('affects remaining calculation', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(80);
      expect(tracker.getRemaining()).toBe(20);
      tracker.setLimit(200);
      expect(tracker.getRemaining()).toBe(120);
    });

    it('can un-breach when limit is increased', () => {
      const tracker = new SpendTracker(100);
      tracker.addSpend(100);
      expect(tracker.isBreached()).toBe(true);
      tracker.setLimit(200);
      expect(tracker.isBreached()).toBe(false);
    });
  });

  describe('getLimit', () => {
    it('returns the configured limit', () => {
      const tracker = new SpendTracker(42);
      expect(tracker.getLimit()).toBe(42);
    });
  });
});
