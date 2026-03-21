import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine } from '../state-machine';
import type { BreachedThreshold } from '../state-machine';

describe('StateMachine', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const hourlyThreshold: BreachedThreshold = {
    window: 'hourly',
    limit: 10,
    spent: 12,
  };

  const dailyThreshold: BreachedThreshold = {
    window: 'daily',
    limit: 100,
    spent: 105,
  };

  describe('initial state', () => {
    it('starts in closed state by default', () => {
      const sm = new StateMachine();
      expect(sm.getState()).toBe('closed');
    });

    it('accepts a custom initial state', () => {
      const sm = new StateMachine(1, 5000, 'open');
      expect(sm.getState()).toBe('open');
    });

    it('has no breached threshold initially', () => {
      const sm = new StateMachine();
      expect(sm.getBreachedThreshold()).toBeNull();
    });

    it('starts with full probes', () => {
      const sm = new StateMachine(3);
      expect(sm.getProbesRemaining()).toBe(3);
    });
  });

  describe('tripOpen', () => {
    it('transitions closed -> open', () => {
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      expect(sm.getState()).toBe('open');
    });

    it('stores the breached threshold', () => {
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      expect(sm.getBreachedThreshold()).toEqual(hourlyThreshold);
    });

    it('resets probes to probeCount on trip', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      sm.consumeProbe();
      expect(sm.getProbesRemaining()).toBe(2);
      sm.tripOpen(hourlyThreshold);
      expect(sm.getProbesRemaining()).toBe(3);
    });

    it('transitions half-open -> open (probe failed)', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      sm.tripOpen(dailyThreshold);
      expect(sm.getState()).toBe('open');
      expect(sm.getBreachedThreshold()).toEqual(dailyThreshold);
    });

    it('is a no-op when already open', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      expect(sm.getState()).toBe('open');
      // Try tripping again with a different threshold — should be ignored
      sm.tripOpen(dailyThreshold);
      expect(sm.getBreachedThreshold()).toEqual(hourlyThreshold);
    });
  });

  describe('tryTransitionToHalfOpen', () => {
    it('returns false when state is closed', () => {
      const sm = new StateMachine();
      expect(sm.tryTransitionToHalfOpen()).toBe(false);
      expect(sm.getState()).toBe('closed');
    });

    it('returns false when state is half-open', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      expect(sm.tryTransitionToHalfOpen()).toBe(false);
      expect(sm.getState()).toBe('half-open');
    });

    it('fails during cooldown period', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);
      sm.tripOpen(hourlyThreshold);

      // Advance 4999ms — still within cooldown
      vi.advanceTimersByTime(4999);
      expect(sm.tryTransitionToHalfOpen()).toBe(false);
      expect(sm.getState()).toBe('open');
    });

    it('succeeds after cooldown expires', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);
      sm.tripOpen(hourlyThreshold);

      // Advance exactly 5000ms — cooldown elapsed
      vi.advanceTimersByTime(5000);
      expect(sm.tryTransitionToHalfOpen()).toBe(true);
      expect(sm.getState()).toBe('half-open');
    });

    it('succeeds well after cooldown expires', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);
      sm.tripOpen(hourlyThreshold);

      vi.advanceTimersByTime(60000);
      expect(sm.tryTransitionToHalfOpen()).toBe(true);
      expect(sm.getState()).toBe('half-open');
    });

    it('resets probes on transition to half-open', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(3, 5000);
      sm.tripOpen(hourlyThreshold);

      vi.advanceTimersByTime(5000);
      sm.tryTransitionToHalfOpen();
      expect(sm.getProbesRemaining()).toBe(3);
    });

    it('accepts a custom now parameter', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);
      sm.tripOpen(hourlyThreshold);

      const openedAt = Date.now();
      // Pass a custom timestamp that is past cooldown
      expect(sm.tryTransitionToHalfOpen(openedAt + 5000)).toBe(true);
      expect(sm.getState()).toBe('half-open');
    });
  });

  describe('consumeProbe', () => {
    it('returns false when state is closed', () => {
      const sm = new StateMachine();
      expect(sm.consumeProbe()).toBe(false);
    });

    it('returns false when state is open', () => {
      const sm = new StateMachine(1, 5000, 'open');
      expect(sm.consumeProbe()).toBe(false);
    });

    it('decrements probes in half-open state', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      expect(sm.getProbesRemaining()).toBe(3);

      expect(sm.consumeProbe()).toBe(true);
      expect(sm.getProbesRemaining()).toBe(2);

      expect(sm.consumeProbe()).toBe(true);
      expect(sm.getProbesRemaining()).toBe(1);

      expect(sm.consumeProbe()).toBe(true);
      expect(sm.getProbesRemaining()).toBe(0);
    });

    it('returns false when no probes left', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      expect(sm.consumeProbe()).toBe(true);
      expect(sm.getProbesRemaining()).toBe(0);

      expect(sm.consumeProbe()).toBe(false);
      expect(sm.getProbesRemaining()).toBe(0);
    });
  });

  describe('closeCircuit', () => {
    it('transitions half-open -> closed', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      sm.closeCircuit();
      expect(sm.getState()).toBe('closed');
    });

    it('clears breached threshold on close', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);
      sm.tripOpen(hourlyThreshold);
      vi.advanceTimersByTime(5000);
      sm.tryTransitionToHalfOpen();
      sm.closeCircuit();
      expect(sm.getBreachedThreshold()).toBeNull();
    });

    it('resets probes to probeCount', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      sm.consumeProbe();
      sm.consumeProbe();
      expect(sm.getProbesRemaining()).toBe(1);
      sm.closeCircuit();
      expect(sm.getProbesRemaining()).toBe(3);
    });

    it('works from open state (manual close)', () => {
      const sm = new StateMachine(1, 5000, 'open');
      sm.closeCircuit();
      expect(sm.getState()).toBe('closed');
    });

    it('is idempotent from closed state', () => {
      const sm = new StateMachine();
      sm.closeCircuit();
      expect(sm.getState()).toBe('closed');
    });
  });

  describe('reset', () => {
    it('resets from open -> closed', () => {
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      sm.reset();
      expect(sm.getState()).toBe('closed');
    });

    it('resets from half-open -> closed', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      sm.reset();
      expect(sm.getState()).toBe('closed');
    });

    it('clears breached threshold', () => {
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      sm.reset();
      expect(sm.getBreachedThreshold()).toBeNull();
    });

    it('resets probes to probeCount', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      sm.consumeProbe();
      sm.consumeProbe();
      sm.reset();
      expect(sm.getProbesRemaining()).toBe(3);
    });

    it('is idempotent from closed state', () => {
      const sm = new StateMachine();
      sm.reset();
      expect(sm.getState()).toBe('closed');
      expect(sm.getBreachedThreshold()).toBeNull();
    });
  });

  describe('isCallAllowed', () => {
    it('returns true when closed', () => {
      const sm = new StateMachine();
      expect(sm.isCallAllowed()).toBe(true);
    });

    it('returns false when open', () => {
      const sm = new StateMachine();
      sm.tripOpen(hourlyThreshold);
      expect(sm.isCallAllowed()).toBe(false);
    });

    it('returns true when half-open with probes remaining', () => {
      const sm = new StateMachine(2, 5000, 'half-open');
      expect(sm.isCallAllowed()).toBe(true);
    });

    it('returns false when half-open with no probes remaining', () => {
      const sm = new StateMachine(1, 5000, 'half-open');
      sm.consumeProbe();
      expect(sm.isCallAllowed()).toBe(false);
    });

    it('returns true after consuming some but not all probes', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      sm.consumeProbe();
      sm.consumeProbe();
      expect(sm.getProbesRemaining()).toBe(1);
      expect(sm.isCallAllowed()).toBe(true);
    });
  });

  describe('custom probeCount', () => {
    it('supports probeCount of 3', () => {
      const sm = new StateMachine(3, 5000, 'half-open');
      expect(sm.getProbesRemaining()).toBe(3);

      expect(sm.consumeProbe()).toBe(true);
      expect(sm.consumeProbe()).toBe(true);
      expect(sm.consumeProbe()).toBe(true);
      expect(sm.consumeProbe()).toBe(false);
      expect(sm.getProbesRemaining()).toBe(0);
    });

    it('supports probeCount of 5', () => {
      const sm = new StateMachine(5);
      expect(sm.getProbesRemaining()).toBe(5);
    });
  });

  describe('custom cooldownMs', () => {
    it('respects a short cooldown (100ms)', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 100);
      sm.tripOpen(hourlyThreshold);

      vi.advanceTimersByTime(99);
      expect(sm.tryTransitionToHalfOpen()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(sm.tryTransitionToHalfOpen()).toBe(true);
      expect(sm.getState()).toBe('half-open');
    });

    it('respects a long cooldown (60000ms)', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 60000);
      sm.tripOpen(hourlyThreshold);

      vi.advanceTimersByTime(59999);
      expect(sm.tryTransitionToHalfOpen()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(sm.tryTransitionToHalfOpen()).toBe(true);
    });
  });

  describe('full lifecycle', () => {
    it('closed -> open -> half-open -> closed', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);

      // Start closed
      expect(sm.getState()).toBe('closed');
      expect(sm.isCallAllowed()).toBe(true);

      // Trip open
      sm.tripOpen(hourlyThreshold);
      expect(sm.getState()).toBe('open');
      expect(sm.isCallAllowed()).toBe(false);

      // Wait for cooldown
      vi.advanceTimersByTime(5000);
      sm.tryTransitionToHalfOpen();
      expect(sm.getState()).toBe('half-open');
      expect(sm.isCallAllowed()).toBe(true);

      // Consume probe
      sm.consumeProbe();
      expect(sm.getProbesRemaining()).toBe(0);
      expect(sm.isCallAllowed()).toBe(false);

      // Close circuit (probe succeeded)
      sm.closeCircuit();
      expect(sm.getState()).toBe('closed');
      expect(sm.isCallAllowed()).toBe(true);
      expect(sm.getBreachedThreshold()).toBeNull();
    });

    it('closed -> open -> half-open -> open (probe failed)', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 5000);

      sm.tripOpen(hourlyThreshold);
      vi.advanceTimersByTime(5000);
      sm.tryTransitionToHalfOpen();
      expect(sm.getState()).toBe('half-open');

      // Probe failed — trip back to open
      sm.tripOpen(dailyThreshold);
      expect(sm.getState()).toBe('open');
      expect(sm.getBreachedThreshold()).toEqual(dailyThreshold);
    });

    it('open -> half-open -> open -> half-open -> closed (retry cycle)', () => {
      vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
      const sm = new StateMachine(1, 1000);

      // Trip open
      sm.tripOpen(hourlyThreshold);

      // First half-open attempt
      vi.advanceTimersByTime(1000);
      sm.tryTransitionToHalfOpen();
      expect(sm.getState()).toBe('half-open');

      // Probe fails, back to open
      sm.tripOpen(hourlyThreshold);
      expect(sm.getState()).toBe('open');

      // Second half-open attempt
      vi.advanceTimersByTime(1000);
      sm.tryTransitionToHalfOpen();
      expect(sm.getState()).toBe('half-open');

      // Probe succeeds, close
      sm.consumeProbe();
      sm.closeCircuit();
      expect(sm.getState()).toBe('closed');
    });
  });

  describe('custom window types', () => {
    it('stores a custom window in the breached threshold', () => {
      const customThreshold: BreachedThreshold = {
        window: { type: 'custom', durationMs: 900000 },
        limit: 50,
        spent: 55,
      };
      const sm = new StateMachine();
      sm.tripOpen(customThreshold);
      expect(sm.getBreachedThreshold()).toEqual(customThreshold);
    });
  });
});
