import { describe, it, expect, vi } from 'vitest';
import { FallbackHandler } from '../fallback';
import type { FallbackContext } from '../fallback';
import { BudgetExceededError } from '../budget-exceeded-error';
import type { BreakerState } from '../types';

function makeContext(overrides?: Partial<FallbackContext>): FallbackContext {
  return {
    threshold: { window: 'hourly', limit: 10, spent: 12 },
    resetsIn: 1800000,
    circuitState: 'open',
    state: {
      state: 'open',
      totalSpent: 12,
      windows: [
        {
          window: 'hourly',
          spent: 12,
          limit: 10,
          remaining: 0,
          resetsIn: 1800000,
          windowStart: '2024-01-01T00:00:00.000Z',
          windowEnd: '2024-01-01T01:00:00.000Z',
          breached: true,
          history: [],
        },
      ],
      probesRemaining: 0,
      breachedThreshold: { window: 'hourly', limit: 10, spent: 12 },
    },
    ...overrides,
  };
}

describe('FallbackHandler', () => {
  describe('throw strategy', () => {
    it('throws BudgetExceededError with correct threshold, resetsIn, circuitState', async () => {
      const handler = new FallbackHandler({ strategy: 'throw' });
      const ctx = makeContext();

      try {
        await handler.execute(undefined, ctx);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BudgetExceededError);
        const budgetErr = err as BudgetExceededError;
        expect(budgetErr.threshold).toEqual({ window: 'hourly', limit: 10, spent: 12 });
        expect(budgetErr.resetsIn).toBe(1800000);
        expect(budgetErr.circuitState).toBe('open');
      }
    });

    it('error message is human-readable', async () => {
      const handler = new FallbackHandler({ strategy: 'throw' });
      const ctx = makeContext();

      try {
        await handler.execute(undefined, ctx);
        expect.unreachable('should have thrown');
      } catch (err) {
        const budgetErr = err as BudgetExceededError;
        expect(budgetErr.message).toBe(
          'Budget exceeded: spent $12.00 of $10.00 hourly budget. Circuit is open. Resets in 1800s.',
        );
      }
    });

    it('throws with custom window threshold', async () => {
      const handler = new FallbackHandler({ strategy: 'throw' });
      const ctx = makeContext({
        threshold: { window: { type: 'custom', durationMs: 900000 }, limit: 5, spent: 6.5 },
        circuitState: 'half-open',
        resetsIn: 450000,
      });

      try {
        await handler.execute(undefined, ctx);
        expect.unreachable('should have thrown');
      } catch (err) {
        const budgetErr = err as BudgetExceededError;
        expect(budgetErr.threshold.window).toEqual({ type: 'custom', durationMs: 900000 });
        expect(budgetErr.circuitState).toBe('half-open');
      }
    });
  });

  describe('cached strategy', () => {
    it('returns cached response when available', async () => {
      const handler = new FallbackHandler<string, string>({ strategy: 'cached' });
      handler.cacheResponse('cached-result');
      const ctx = makeContext();

      const result = await handler.execute('any-arg', ctx);
      expect(result).toBe('cached-result');
    });

    it('throws BudgetExceededError when no cache exists', async () => {
      const handler = new FallbackHandler({ strategy: 'cached' });
      const ctx = makeContext();

      try {
        await handler.execute(undefined, ctx);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BudgetExceededError);
        const budgetErr = err as BudgetExceededError;
        expect(budgetErr.threshold).toEqual({ window: 'hourly', limit: 10, spent: 12 });
        expect(budgetErr.resetsIn).toBe(1800000);
        expect(budgetErr.circuitState).toBe('open');
      }
    });

    it('cacheResponse updates the cached value', async () => {
      const handler = new FallbackHandler<string, string>({ strategy: 'cached' });
      const ctx = makeContext();

      handler.cacheResponse('first');
      const result1 = await handler.execute('arg', ctx);
      expect(result1).toBe('first');

      handler.cacheResponse('second');
      const result2 = await handler.execute('arg', ctx);
      expect(result2).toBe('second');
    });

    it('latest cache replaces previous', async () => {
      const handler = new FallbackHandler<unknown, number>({ strategy: 'cached' });
      const ctx = makeContext();

      handler.cacheResponse(42);
      handler.cacheResponse(99);
      const result = await handler.execute(undefined, ctx);
      expect(result).toBe(99);
    });

    it('cache is not argument-specific', async () => {
      const handler = new FallbackHandler<string, string>({ strategy: 'cached' });
      const ctx = makeContext();

      handler.cacheResponse('shared-cache');

      const result1 = await handler.execute('arg-a', ctx);
      const result2 = await handler.execute('arg-b', ctx);
      const result3 = await handler.execute('arg-c', ctx);

      expect(result1).toBe('shared-cache');
      expect(result2).toBe('shared-cache');
      expect(result3).toBe('shared-cache');
    });
  });

  describe('downgrade strategy', () => {
    it('calls fn with original args', async () => {
      const fn = vi.fn().mockResolvedValue('downgraded');
      const handler = new FallbackHandler<string, string>({ strategy: 'downgrade', fn });
      const ctx = makeContext();

      await handler.execute('my-prompt', ctx);
      expect(fn).toHaveBeenCalledWith('my-prompt');
    });

    it('returns fn return value', async () => {
      const fn = vi.fn().mockResolvedValue('cheap-result');
      const handler = new FallbackHandler<string, string>({ strategy: 'downgrade', fn });
      const ctx = makeContext();

      const result = await handler.execute('prompt', ctx);
      expect(result).toBe('cheap-result');
    });

    it('fn receives exact same args', async () => {
      const complexArg = { model: 'gpt-4', messages: [{ role: 'user', content: 'hello' }] };
      const fn = vi.fn().mockResolvedValue('ok');
      const handler = new FallbackHandler<typeof complexArg, string>({ strategy: 'downgrade', fn });
      const ctx = makeContext();

      await handler.execute(complexArg, ctx);
      expect(fn).toHaveBeenCalledWith(complexArg);
      expect(fn.mock.calls[0][0]).toBe(complexArg); // same reference
    });
  });

  describe('custom strategy', () => {
    it('calls fn with args AND BreakerState', async () => {
      const fn = vi.fn().mockResolvedValue('custom-result');
      const handler = new FallbackHandler<string, string>({ strategy: 'custom', fn });
      const ctx = makeContext();

      await handler.execute('my-input', ctx);
      expect(fn).toHaveBeenCalledWith('my-input', ctx.state);
    });

    it('state reflects current window details', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const handler = new FallbackHandler<string, string>({ strategy: 'custom', fn });

      const state: BreakerState = {
        state: 'open',
        totalSpent: 55,
        windows: [
          {
            window: 'hourly',
            spent: 15,
            limit: 10,
            remaining: 0,
            resetsIn: 900000,
            windowStart: '2024-06-15T14:00:00.000Z',
            windowEnd: '2024-06-15T15:00:00.000Z',
            breached: true,
            history: [{ cost: 15, timestamp: '2024-06-15T14:30:00.000Z' }],
          },
          {
            window: 'daily',
            spent: 55,
            limit: 100,
            remaining: 45,
            resetsIn: 36000000,
            windowStart: '2024-06-15T00:00:00.000Z',
            windowEnd: '2024-06-16T00:00:00.000Z',
            breached: false,
            history: [],
          },
        ],
        probesRemaining: 0,
        breachedThreshold: { window: 'hourly', limit: 10, spent: 15 },
      };

      const ctx = makeContext({ state });
      await handler.execute('input', ctx);

      const receivedState = fn.mock.calls[0][1] as BreakerState;
      expect(receivedState.state).toBe('open');
      expect(receivedState.totalSpent).toBe(55);
      expect(receivedState.windows).toHaveLength(2);
      expect(receivedState.windows[0].breached).toBe(true);
      expect(receivedState.windows[1].breached).toBe(false);
      expect(receivedState.breachedThreshold).toEqual({ window: 'hourly', limit: 10, spent: 15 });
    });

    it('returns fn return value', async () => {
      const fn = vi.fn().mockResolvedValue({ fallback: true, data: 'cached-locally' });
      const handler = new FallbackHandler<string, { fallback: boolean; data: string }>({
        strategy: 'custom',
        fn,
      });
      const ctx = makeContext();

      const result = await handler.execute('input', ctx);
      expect(result).toEqual({ fallback: true, data: 'cached-locally' });
    });
  });
});
