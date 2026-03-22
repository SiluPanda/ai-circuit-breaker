"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const state_machine_1 = require("../state-machine");
(0, vitest_1.describe)('StateMachine', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    const hourlyThreshold = {
        window: 'hourly',
        limit: 10,
        spent: 12,
    };
    const dailyThreshold = {
        window: 'daily',
        limit: 100,
        spent: 105,
    };
    (0, vitest_1.describe)('initial state', () => {
        (0, vitest_1.it)('starts in closed state by default', () => {
            const sm = new state_machine_1.StateMachine();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('accepts a custom initial state', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'open');
            (0, vitest_1.expect)(sm.getState()).toBe('open');
        });
        (0, vitest_1.it)('has no breached threshold initially', () => {
            const sm = new state_machine_1.StateMachine();
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toBeNull();
        });
        (0, vitest_1.it)('starts with full probes', () => {
            const sm = new state_machine_1.StateMachine(3);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
        });
    });
    (0, vitest_1.describe)('tripOpen', () => {
        (0, vitest_1.it)('transitions closed -> open', () => {
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
        });
        (0, vitest_1.it)('stores the breached threshold', () => {
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toEqual(hourlyThreshold);
        });
        (0, vitest_1.it)('resets probes to probeCount on trip', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            sm.consumeProbe();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(2);
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
        });
        (0, vitest_1.it)('transitions half-open -> open (probe failed)', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            sm.tripOpen(dailyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toEqual(dailyThreshold);
        });
        (0, vitest_1.it)('is a no-op when already open', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
            // Try tripping again with a different threshold — should be ignored
            sm.tripOpen(dailyThreshold);
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toEqual(hourlyThreshold);
        });
    });
    (0, vitest_1.describe)('tryTransitionToHalfOpen', () => {
        (0, vitest_1.it)('returns false when state is closed', () => {
            const sm = new state_machine_1.StateMachine();
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(false);
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('returns false when state is half-open', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(false);
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
        });
        (0, vitest_1.it)('fails during cooldown period', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            // Advance 4999ms — still within cooldown
            vitest_1.vi.advanceTimersByTime(4999);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(false);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
        });
        (0, vitest_1.it)('succeeds after cooldown expires', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            // Advance exactly 5000ms — cooldown elapsed
            vitest_1.vi.advanceTimersByTime(5000);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(true);
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
        });
        (0, vitest_1.it)('succeeds well after cooldown expires', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(60000);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(true);
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
        });
        (0, vitest_1.it)('resets probes on transition to half-open', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(3, 5000);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(5000);
            sm.tryTransitionToHalfOpen();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
        });
        (0, vitest_1.it)('accepts a custom now parameter', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            const openedAt = Date.now();
            // Pass a custom timestamp that is past cooldown
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen(openedAt + 5000)).toBe(true);
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
        });
    });
    (0, vitest_1.describe)('consumeProbe', () => {
        (0, vitest_1.it)('returns false when state is closed', () => {
            const sm = new state_machine_1.StateMachine();
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(false);
        });
        (0, vitest_1.it)('returns false when state is open', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'open');
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(false);
        });
        (0, vitest_1.it)('decrements probes in half-open state', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(2);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(1);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(0);
        });
        (0, vitest_1.it)('returns false when no probes left', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(0);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(false);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(0);
        });
    });
    (0, vitest_1.describe)('closeCircuit', () => {
        (0, vitest_1.it)('transitions half-open -> closed', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('clears breached threshold on close', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(5000);
            sm.tryTransitionToHalfOpen();
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toBeNull();
        });
        (0, vitest_1.it)('resets probes to probeCount', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            sm.consumeProbe();
            sm.consumeProbe();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(1);
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
        });
        (0, vitest_1.it)('works from open state (manual close)', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'open');
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('is idempotent from closed state', () => {
            const sm = new state_machine_1.StateMachine();
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
    });
    (0, vitest_1.describe)('reset', () => {
        (0, vitest_1.it)('resets from open -> closed', () => {
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            sm.reset();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('resets from half-open -> closed', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            sm.reset();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
        (0, vitest_1.it)('clears breached threshold', () => {
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            sm.reset();
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toBeNull();
        });
        (0, vitest_1.it)('resets probes to probeCount', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            sm.consumeProbe();
            sm.consumeProbe();
            sm.reset();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
        });
        (0, vitest_1.it)('is idempotent from closed state', () => {
            const sm = new state_machine_1.StateMachine();
            sm.reset();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toBeNull();
        });
    });
    (0, vitest_1.describe)('isCallAllowed', () => {
        (0, vitest_1.it)('returns true when closed', () => {
            const sm = new state_machine_1.StateMachine();
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
        });
        (0, vitest_1.it)('returns false when open', () => {
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(false);
        });
        (0, vitest_1.it)('returns true when half-open with probes remaining', () => {
            const sm = new state_machine_1.StateMachine(2, 5000, 'half-open');
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
        });
        (0, vitest_1.it)('returns false when half-open with no probes remaining', () => {
            const sm = new state_machine_1.StateMachine(1, 5000, 'half-open');
            sm.consumeProbe();
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(false);
        });
        (0, vitest_1.it)('returns true after consuming some but not all probes', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            sm.consumeProbe();
            sm.consumeProbe();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(1);
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
        });
    });
    (0, vitest_1.describe)('custom probeCount', () => {
        (0, vitest_1.it)('supports probeCount of 3', () => {
            const sm = new state_machine_1.StateMachine(3, 5000, 'half-open');
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(3);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(true);
            (0, vitest_1.expect)(sm.consumeProbe()).toBe(false);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(0);
        });
        (0, vitest_1.it)('supports probeCount of 5', () => {
            const sm = new state_machine_1.StateMachine(5);
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(5);
        });
    });
    (0, vitest_1.describe)('custom cooldownMs', () => {
        (0, vitest_1.it)('respects a short cooldown (100ms)', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 100);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(99);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(false);
            vitest_1.vi.advanceTimersByTime(1);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(true);
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
        });
        (0, vitest_1.it)('respects a long cooldown (60000ms)', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 60000);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(59999);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(false);
            vitest_1.vi.advanceTimersByTime(1);
            (0, vitest_1.expect)(sm.tryTransitionToHalfOpen()).toBe(true);
        });
    });
    (0, vitest_1.describe)('full lifecycle', () => {
        (0, vitest_1.it)('closed -> open -> half-open -> closed', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            // Start closed
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
            // Trip open
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(false);
            // Wait for cooldown
            vitest_1.vi.advanceTimersByTime(5000);
            sm.tryTransitionToHalfOpen();
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
            // Consume probe
            sm.consumeProbe();
            (0, vitest_1.expect)(sm.getProbesRemaining()).toBe(0);
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(false);
            // Close circuit (probe succeeded)
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
            (0, vitest_1.expect)(sm.isCallAllowed()).toBe(true);
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toBeNull();
        });
        (0, vitest_1.it)('closed -> open -> half-open -> open (probe failed)', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 5000);
            sm.tripOpen(hourlyThreshold);
            vitest_1.vi.advanceTimersByTime(5000);
            sm.tryTransitionToHalfOpen();
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
            // Probe failed — trip back to open
            sm.tripOpen(dailyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toEqual(dailyThreshold);
        });
        (0, vitest_1.it)('open -> half-open -> open -> half-open -> closed (retry cycle)', () => {
            vitest_1.vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));
            const sm = new state_machine_1.StateMachine(1, 1000);
            // Trip open
            sm.tripOpen(hourlyThreshold);
            // First half-open attempt
            vitest_1.vi.advanceTimersByTime(1000);
            sm.tryTransitionToHalfOpen();
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
            // Probe fails, back to open
            sm.tripOpen(hourlyThreshold);
            (0, vitest_1.expect)(sm.getState()).toBe('open');
            // Second half-open attempt
            vitest_1.vi.advanceTimersByTime(1000);
            sm.tryTransitionToHalfOpen();
            (0, vitest_1.expect)(sm.getState()).toBe('half-open');
            // Probe succeeds, close
            sm.consumeProbe();
            sm.closeCircuit();
            (0, vitest_1.expect)(sm.getState()).toBe('closed');
        });
    });
    (0, vitest_1.describe)('custom window types', () => {
        (0, vitest_1.it)('stores a custom window in the breached threshold', () => {
            const customThreshold = {
                window: { type: 'custom', durationMs: 900000 },
                limit: 50,
                spent: 55,
            };
            const sm = new state_machine_1.StateMachine();
            sm.tripOpen(customThreshold);
            (0, vitest_1.expect)(sm.getBreachedThreshold()).toEqual(customThreshold);
        });
    });
});
//# sourceMappingURL=state-machine.test.js.map