import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBreaker } from '../breaker';
import type { BreakerConfig } from '../types';

function makeConfig<TArgs = unknown, TResult = unknown>(
  overrides?: Partial<BreakerConfig<TArgs, TResult>>,
): BreakerConfig<TArgs, TResult> {
  return {
    budgets: [{ window: 'hourly', limit: 10 }],
    ...overrides,
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('onHalfOpen hook', () => {
  it('fires with reason "window-reset" when window expires and circuit transitions to half-open', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: { type: 'custom', durationMs: 5000 }, limit: 10 }],
      cooldownMs: 0,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(11); // open the circuit
    // Use exportState() to check state without triggering lazyWindowReset
    // (getState() would trigger transition to half-open since cooldownMs is 0)
    expect(breaker.exportState().state).toBe('open');

    vi.advanceTimersByTime(5001); // expire the window
    breaker.getState(); // trigger lazy check

    expect(onHalfOpen).toHaveBeenCalledTimes(1);
    expect(onHalfOpen).toHaveBeenCalledWith({
      reason: 'window-reset',
      probeCount: 1,
    });
  });

  it('fires with reason "budget-replenished" when addBudget brings spend below limit', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      cooldownMs: 0,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(11); // open the circuit (exceeds limit of 10)
    expect(breaker.exportState().state).toBe('open');

    breaker.addBudget('hourly', 5); // limit becomes 15, spend is 11 (below limit)

    expect(onHalfOpen).toHaveBeenCalledTimes(1);
    expect(onHalfOpen).toHaveBeenCalledWith({
      reason: 'budget-replenished',
      probeCount: 1,
    });
  });

  it('fires with reason "cooldown-expired" when cooldown elapses without window reset', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: 'hourly', limit: 10 }], // hourly window won't expire in 6s
      cooldownMs: 5000,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(11); // open the circuit
    expect(breaker.getState().state).toBe('open');

    vi.advanceTimersByTime(5001); // cooldown expires, but hourly window still active
    breaker.getState(); // trigger lazy check

    expect(onHalfOpen).toHaveBeenCalledTimes(1);
    expect(onHalfOpen).toHaveBeenCalledWith({
      reason: 'cooldown-expired',
      probeCount: 1,
    });
  });

  it('does not fire during cooldown period', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: { type: 'custom', durationMs: 2000 }, limit: 10 }],
      cooldownMs: 5000,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(11); // open
    vi.advanceTimersByTime(2001); // window expires but cooldown not done
    breaker.getState();
    expect(onHalfOpen).not.toHaveBeenCalled();
    expect(breaker.getState().state).toBe('open');
  });

  it('reports configured probeCount in the payload', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: { type: 'custom', durationMs: 5000 }, limit: 10 }],
      cooldownMs: 0,
      probeCount: 3,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(11);
    vi.advanceTimersByTime(5001);
    breaker.getState();

    expect(onHalfOpen).toHaveBeenCalledWith({
      reason: 'window-reset',
      probeCount: 3,
    });
  });
});

describe('hooks are optional', () => {
  it('does not throw when no hooks are configured', () => {
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: { type: 'custom', durationMs: 1000 }, limit: 10 }],
      cooldownMs: 0,
    }));

    breaker.recordSpend(11); // triggers onOpen (no hook)
    vi.advanceTimersByTime(1001);
    breaker.getState(); // triggers onWindowReset + onHalfOpen (no hooks)
    breaker.reset(); // triggers onClose (no hook)
    // No errors thrown
  });
});

describe('edge cases', () => {
  it('extremely small costs accumulate correctly across many calls', () => {
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: 'hourly', limit: 0.01 }],
    }));

    for (let i = 0; i < 1000; i++) {
      breaker.recordSpend(0.000001);
    }

    // 1000 * 0.000001 = 0.001
    const state = breaker.getState();
    expect(state.totalSpent).toBeCloseTo(0.001, 10);
    expect(state.state).toBe('closed'); // 0.001 < 0.01
  });

  it('extremely small costs breach threshold correctly', () => {
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: 'hourly', limit: 0.001 }],
    }));

    for (let i = 0; i < 2000; i++) {
      breaker.recordSpend(0.000001);
    }

    // 2000 * 0.000001 = 0.002, which exceeds 0.001
    expect(breaker.getState().state).toBe('open');
  });

  it('rapid sequential calls accumulate correctly', () => {
    const breaker = createBreaker(makeConfig());
    for (let i = 0; i < 100; i++) {
      breaker.recordSpend(0.11);
    }
    // 100 * 0.11 = 11.0 which exceeds limit of 10
    expect(breaker.getState().totalSpent).toBeCloseTo(11, 5);
    expect(breaker.getState().state).toBe('open');
  });

  it('window reset with no spend fires onWindowReset with previousSpent: 0', () => {
    const onWindowReset = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: { type: 'custom', durationMs: 1000 }, limit: 10 }],
      hooks: { onWindowReset },
    }));

    // Don't record any spend, just advance past the window
    vi.advanceTimersByTime(1001);
    breaker.getState(); // trigger lazy check

    expect(onWindowReset).toHaveBeenCalledWith({
      window: { type: 'custom', durationMs: 1000 },
      previousSpent: 0,
    });
  });

  it('multiple windows reset simultaneously fires multiple onWindowReset events', () => {
    const onWindowReset = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [
        { window: { type: 'custom', durationMs: 1000 }, limit: 10 },
        { window: { type: 'custom', durationMs: 2000 }, limit: 20 },
      ],
      hooks: { onWindowReset },
    }));

    breaker.recordSpend(5);

    // Advance past both windows
    vi.advanceTimersByTime(2001);
    breaker.getState();

    expect(onWindowReset).toHaveBeenCalledTimes(2);
  });

  it('addBudget with amount still leaving spend above limit does not transition', () => {
    const onHalfOpen = vi.fn();
    const breaker = createBreaker(makeConfig({
      budgets: [{ window: 'hourly', limit: 10 }],
      cooldownMs: 0,
      hooks: { onHalfOpen },
    }));

    breaker.recordSpend(20); // way over limit
    expect(breaker.exportState().state).toBe('open');

    breaker.addBudget('hourly', 5); // limit becomes 15, but spent is 20
    expect(breaker.exportState().state).toBe('open');
    expect(onHalfOpen).not.toHaveBeenCalled();
  });
});
