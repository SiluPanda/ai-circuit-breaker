"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fallback_1 = require("../fallback");
const budget_exceeded_error_1 = require("../budget-exceeded-error");
function makeContext(overrides) {
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
(0, vitest_1.describe)('FallbackHandler', () => {
    (0, vitest_1.describe)('throw strategy', () => {
        (0, vitest_1.it)('throws BudgetExceededError with correct threshold, resetsIn, circuitState', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'throw' });
            const ctx = makeContext();
            try {
                await handler.execute(undefined, ctx);
                vitest_1.expect.unreachable('should have thrown');
            }
            catch (err) {
                (0, vitest_1.expect)(err).toBeInstanceOf(budget_exceeded_error_1.BudgetExceededError);
                const budgetErr = err;
                (0, vitest_1.expect)(budgetErr.threshold).toEqual({ window: 'hourly', limit: 10, spent: 12 });
                (0, vitest_1.expect)(budgetErr.resetsIn).toBe(1800000);
                (0, vitest_1.expect)(budgetErr.circuitState).toBe('open');
            }
        });
        (0, vitest_1.it)('error message is human-readable', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'throw' });
            const ctx = makeContext();
            try {
                await handler.execute(undefined, ctx);
                vitest_1.expect.unreachable('should have thrown');
            }
            catch (err) {
                const budgetErr = err;
                (0, vitest_1.expect)(budgetErr.message).toBe('Budget exceeded: spent $12.00 of $10.00 hourly budget. Circuit is open. Resets in 1800s.');
            }
        });
        (0, vitest_1.it)('throws with custom window threshold', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'throw' });
            const ctx = makeContext({
                threshold: { window: { type: 'custom', durationMs: 900000 }, limit: 5, spent: 6.5 },
                circuitState: 'half-open',
                resetsIn: 450000,
            });
            try {
                await handler.execute(undefined, ctx);
                vitest_1.expect.unreachable('should have thrown');
            }
            catch (err) {
                const budgetErr = err;
                (0, vitest_1.expect)(budgetErr.threshold.window).toEqual({ type: 'custom', durationMs: 900000 });
                (0, vitest_1.expect)(budgetErr.circuitState).toBe('half-open');
            }
        });
    });
    (0, vitest_1.describe)('cached strategy', () => {
        (0, vitest_1.it)('returns cached response when available', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'cached' });
            handler.cacheResponse('cached-result');
            const ctx = makeContext();
            const result = await handler.execute('any-arg', ctx);
            (0, vitest_1.expect)(result).toBe('cached-result');
        });
        (0, vitest_1.it)('throws BudgetExceededError when no cache exists', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'cached' });
            const ctx = makeContext();
            try {
                await handler.execute(undefined, ctx);
                vitest_1.expect.unreachable('should have thrown');
            }
            catch (err) {
                (0, vitest_1.expect)(err).toBeInstanceOf(budget_exceeded_error_1.BudgetExceededError);
                const budgetErr = err;
                (0, vitest_1.expect)(budgetErr.threshold).toEqual({ window: 'hourly', limit: 10, spent: 12 });
                (0, vitest_1.expect)(budgetErr.resetsIn).toBe(1800000);
                (0, vitest_1.expect)(budgetErr.circuitState).toBe('open');
            }
        });
        (0, vitest_1.it)('cacheResponse updates the cached value', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'cached' });
            const ctx = makeContext();
            handler.cacheResponse('first');
            const result1 = await handler.execute('arg', ctx);
            (0, vitest_1.expect)(result1).toBe('first');
            handler.cacheResponse('second');
            const result2 = await handler.execute('arg', ctx);
            (0, vitest_1.expect)(result2).toBe('second');
        });
        (0, vitest_1.it)('latest cache replaces previous', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'cached' });
            const ctx = makeContext();
            handler.cacheResponse(42);
            handler.cacheResponse(99);
            const result = await handler.execute(undefined, ctx);
            (0, vitest_1.expect)(result).toBe(99);
        });
        (0, vitest_1.it)('cache is not argument-specific', async () => {
            const handler = new fallback_1.FallbackHandler({ strategy: 'cached' });
            const ctx = makeContext();
            handler.cacheResponse('shared-cache');
            const result1 = await handler.execute('arg-a', ctx);
            const result2 = await handler.execute('arg-b', ctx);
            const result3 = await handler.execute('arg-c', ctx);
            (0, vitest_1.expect)(result1).toBe('shared-cache');
            (0, vitest_1.expect)(result2).toBe('shared-cache');
            (0, vitest_1.expect)(result3).toBe('shared-cache');
        });
    });
    (0, vitest_1.describe)('downgrade strategy', () => {
        (0, vitest_1.it)('calls fn with original args', async () => {
            const fn = vitest_1.vi.fn().mockResolvedValue('downgraded');
            const handler = new fallback_1.FallbackHandler({ strategy: 'downgrade', fn });
            const ctx = makeContext();
            await handler.execute('my-prompt', ctx);
            (0, vitest_1.expect)(fn).toHaveBeenCalledWith('my-prompt');
        });
        (0, vitest_1.it)('returns fn return value', async () => {
            const fn = vitest_1.vi.fn().mockResolvedValue('cheap-result');
            const handler = new fallback_1.FallbackHandler({ strategy: 'downgrade', fn });
            const ctx = makeContext();
            const result = await handler.execute('prompt', ctx);
            (0, vitest_1.expect)(result).toBe('cheap-result');
        });
        (0, vitest_1.it)('fn receives exact same args', async () => {
            const complexArg = { model: 'gpt-4', messages: [{ role: 'user', content: 'hello' }] };
            const fn = vitest_1.vi.fn().mockResolvedValue('ok');
            const handler = new fallback_1.FallbackHandler({ strategy: 'downgrade', fn });
            const ctx = makeContext();
            await handler.execute(complexArg, ctx);
            (0, vitest_1.expect)(fn).toHaveBeenCalledWith(complexArg);
            (0, vitest_1.expect)(fn.mock.calls[0][0]).toBe(complexArg); // same reference
        });
    });
    (0, vitest_1.describe)('custom strategy', () => {
        (0, vitest_1.it)('calls fn with args AND BreakerState', async () => {
            const fn = vitest_1.vi.fn().mockResolvedValue('custom-result');
            const handler = new fallback_1.FallbackHandler({ strategy: 'custom', fn });
            const ctx = makeContext();
            await handler.execute('my-input', ctx);
            (0, vitest_1.expect)(fn).toHaveBeenCalledWith('my-input', ctx.state);
        });
        (0, vitest_1.it)('state reflects current window details', async () => {
            const fn = vitest_1.vi.fn().mockResolvedValue('result');
            const handler = new fallback_1.FallbackHandler({ strategy: 'custom', fn });
            const state = {
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
            const receivedState = fn.mock.calls[0][1];
            (0, vitest_1.expect)(receivedState.state).toBe('open');
            (0, vitest_1.expect)(receivedState.totalSpent).toBe(55);
            (0, vitest_1.expect)(receivedState.windows).toHaveLength(2);
            (0, vitest_1.expect)(receivedState.windows[0].breached).toBe(true);
            (0, vitest_1.expect)(receivedState.windows[1].breached).toBe(false);
            (0, vitest_1.expect)(receivedState.breachedThreshold).toEqual({ window: 'hourly', limit: 10, spent: 15 });
        });
        (0, vitest_1.it)('returns fn return value', async () => {
            const fn = vitest_1.vi.fn().mockResolvedValue({ fallback: true, data: 'cached-locally' });
            const handler = new fallback_1.FallbackHandler({
                strategy: 'custom',
                fn,
            });
            const ctx = makeContext();
            const result = await handler.execute('input', ctx);
            (0, vitest_1.expect)(result).toEqual({ fallback: true, data: 'cached-locally' });
        });
    });
});
//# sourceMappingURL=fallback.test.js.map