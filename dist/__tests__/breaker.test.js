"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const breaker_1 = require("../breaker");
const budget_exceeded_error_1 = require("../budget-exceeded-error");
(0, vitest_1.describe)('createBreaker', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.useFakeTimers(); });
    (0, vitest_1.afterEach)(() => { vitest_1.vi.useRealTimers(); });
    // --- Helpers ---
    function makeConfig(overrides) {
        return {
            budgets: [{ window: 'hourly', limit: 10 }],
            ...overrides,
        };
    }
    // --- Task: createBreaker with valid config returns Breaker with all methods ---
    (0, vitest_1.describe)('factory returns Breaker with all methods', () => {
        (0, vitest_1.it)('returns an object with wrap, recordSpend, recordTokens, getState, wouldExceedBudget, reset, addBudget, exportState', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            (0, vitest_1.expect)(typeof breaker.wrap).toBe('function');
            (0, vitest_1.expect)(typeof breaker.recordSpend).toBe('function');
            (0, vitest_1.expect)(typeof breaker.recordTokens).toBe('function');
            (0, vitest_1.expect)(typeof breaker.getState).toBe('function');
            (0, vitest_1.expect)(typeof breaker.wouldExceedBudget).toBe('function');
            (0, vitest_1.expect)(typeof breaker.reset).toBe('function');
            (0, vitest_1.expect)(typeof breaker.addBudget).toBe('function');
            (0, vitest_1.expect)(typeof breaker.exportState).toBe('function');
        });
    });
    // --- Task: Config validation ---
    (0, vitest_1.describe)('config validation', () => {
        (0, vitest_1.it)('throws TypeError for empty budgets array', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [] })).toThrow(TypeError);
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [] })).toThrow('budgets must be a non-empty array');
        });
        (0, vitest_1.it)('throws TypeError for undefined budgets', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({})).toThrow(TypeError);
        });
        (0, vitest_1.it)('throws TypeError for negative limit', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: -5 }] })).toThrow(TypeError);
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: -5 }] })).toThrow('Budget limit must be positive, got -5');
        });
        (0, vitest_1.it)('throws TypeError for zero limit', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 0 }] })).toThrow(TypeError);
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 0 }] })).toThrow('Budget limit must be positive, got 0');
        });
        (0, vitest_1.it)('throws TypeError for invalid warningThreshold (> 1)', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 10, warningThreshold: 1.5 }] }))
                .toThrow('warningThreshold must be between 0 and 1');
        });
        (0, vitest_1.it)('throws TypeError for invalid warningThreshold (< 0)', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 10, warningThreshold: -0.1 }] }))
                .toThrow('warningThreshold must be between 0 and 1');
        });
        (0, vitest_1.it)('allows warningThreshold of 0', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 10, warningThreshold: 0 }] }))
                .not.toThrow();
        });
        (0, vitest_1.it)('allows warningThreshold of 1', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)({ budgets: [{ window: 'hourly', limit: 10, warningThreshold: 1 }] }))
                .not.toThrow();
        });
        (0, vitest_1.it)('throws TypeError for zero probeCount', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({ probeCount: 0 }))).toThrow('probeCount must be positive');
        });
        (0, vitest_1.it)('throws TypeError for negative probeCount', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({ probeCount: -1 }))).toThrow('probeCount must be positive');
        });
        (0, vitest_1.it)('throws TypeError for negative cooldownMs', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({ cooldownMs: -1 }))).toThrow('cooldownMs must be non-negative');
        });
        (0, vitest_1.it)('allows cooldownMs of 0', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({ cooldownMs: 0 }))).not.toThrow();
        });
        (0, vitest_1.it)('throws TypeError for downgrade strategy without fn', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fallback: { strategy: 'downgrade' },
            }))).toThrow('downgrade strategy requires fn');
        });
        (0, vitest_1.it)('throws TypeError for custom strategy without fn', () => {
            (0, vitest_1.expect)(() => (0, breaker_1.createBreaker)(makeConfig({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fallback: { strategy: 'custom' },
            }))).toThrow('custom strategy requires fn');
        });
    });
    // --- Task: Defaults applied ---
    (0, vitest_1.describe)('defaults', () => {
        (0, vitest_1.it)('applies default probeCount of 1', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const state = breaker.getState();
            (0, vitest_1.expect)(state.probesRemaining).toBe(1);
        });
        (0, vitest_1.it)('applies default cooldownMs of 5000', () => {
            // Breach the budget to open the circuit
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11); // breach
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            // Advance less than 5000ms — still open
            vitest_1.vi.advanceTimersByTime(4999);
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
        });
        (0, vitest_1.it)('defaults fallback to throw strategy', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11); // breach
            const wrapped = breaker.wrap(async () => 'ok');
            await (0, vitest_1.expect)(wrapped(undefined)).rejects.toThrow(budget_exceeded_error_1.BudgetExceededError);
        });
    });
    // --- Task: wrap: wrapped function executes when closed, returns result, passes args ---
    (0, vitest_1.describe)('wrap', () => {
        (0, vitest_1.it)('executes the original function when circuit is closed', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const fn = vitest_1.vi.fn().mockResolvedValue('hello');
            const wrapped = breaker.wrap(fn);
            const result = await wrapped('input');
            (0, vitest_1.expect)(fn).toHaveBeenCalledWith('input');
            (0, vitest_1.expect)(result).toBe('hello');
        });
        (0, vitest_1.it)('returns the original function result', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const fn = vitest_1.vi.fn().mockResolvedValue({ data: 42 });
            const wrapped = breaker.wrap(fn);
            const result = await wrapped(undefined);
            (0, vitest_1.expect)(result).toEqual({ data: 42 });
        });
        (0, vitest_1.it)('passes arguments through to the wrapped function', async () => {
            const complexArg = { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] };
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const fn = vitest_1.vi.fn().mockResolvedValue('response');
            const wrapped = breaker.wrap(fn);
            await wrapped(complexArg);
            (0, vitest_1.expect)(fn).toHaveBeenCalledWith(complexArg);
            (0, vitest_1.expect)(fn.mock.calls[0][0]).toBe(complexArg); // same reference
        });
        (0, vitest_1.it)('blocks calls when circuit is open (throw fallback)', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11);
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            const fn = vitest_1.vi.fn().mockResolvedValue('never');
            const wrapped = breaker.wrap(fn);
            await (0, vitest_1.expect)(wrapped(undefined)).rejects.toThrow(budget_exceeded_error_1.BudgetExceededError);
            (0, vitest_1.expect)(fn).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('multiple wraps share the same breaker state', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: 'hourly', limit: 10 }],
                costExtractor: () => 4,
            }));
            const fn1 = vitest_1.vi.fn().mockResolvedValue('a');
            const fn2 = vitest_1.vi.fn().mockResolvedValue('b');
            const wrapped1 = breaker.wrap(fn1);
            const wrapped2 = breaker.wrap(fn2);
            await wrapped1('x');
            await wrapped2('y');
            // Both calls recorded cost through the same breaker
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(8);
        });
        (0, vitest_1.it)('caches response for cached fallback strategy', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                fallback: { strategy: 'cached' },
            }));
            const fn = vitest_1.vi.fn().mockResolvedValue('cached-value');
            const wrapped = breaker.wrap(fn);
            // First call succeeds and caches
            await wrapped('input');
            // Breach the budget
            breaker.recordSpend(11);
            // Next call uses cached response
            const result = await wrapped('input');
            (0, vitest_1.expect)(result).toBe('cached-value');
        });
        (0, vitest_1.it)('calls costExtractor on successful result', async () => {
            const extractor = vitest_1.vi.fn().mockReturnValue(2.5);
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                costExtractor: extractor,
            }));
            const fn = vitest_1.vi.fn().mockResolvedValue({ usage: 100 });
            const wrapped = breaker.wrap(fn);
            await wrapped('input');
            (0, vitest_1.expect)(extractor).toHaveBeenCalledWith({ usage: 100 });
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(2.5);
        });
        (0, vitest_1.it)('fires onExtractorError when costExtractor throws', async () => {
            const onExtractorError = vitest_1.vi.fn();
            const extractorError = new Error('extractor failed');
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                costExtractor: () => { throw extractorError; },
                hooks: { onExtractorError },
            }));
            const fn = vitest_1.vi.fn().mockResolvedValue('result');
            const wrapped = breaker.wrap(fn);
            // Should not throw — error is caught
            const result = await wrapped('input');
            (0, vitest_1.expect)(result).toBe('result');
            (0, vitest_1.expect)(onExtractorError).toHaveBeenCalledWith({ error: extractorError, result: 'result' });
        });
    });
    // --- Task: recordSpend ---
    (0, vitest_1.describe)('recordSpend', () => {
        (0, vitest_1.it)('accumulates spend across calls', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(3);
            breaker.recordSpend(2);
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(5);
            (0, vitest_1.expect)(breaker.getState().windows[0].spent).toBe(5);
        });
        (0, vitest_1.it)('triggers open state when threshold is breached', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(5);
            (0, vitest_1.expect)(breaker.getState().state).toBe('closed');
            breaker.recordSpend(6); // total: 11, exceeds limit of 10
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
        });
        (0, vitest_1.it)('zero cost is a no-op', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(0);
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(0);
            (0, vitest_1.expect)(breaker.getState().windows[0].spent).toBe(0);
        });
        (0, vitest_1.it)('negative cost throws TypeError', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            (0, vitest_1.expect)(() => breaker.recordSpend(-1)).toThrow(TypeError);
            (0, vitest_1.expect)(() => breaker.recordSpend(-1)).toThrow('cost must be non-negative');
        });
        (0, vitest_1.it)('spend is added to all window accumulators simultaneously', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [
                    { window: 'hourly', limit: 10 },
                    { window: 'daily', limit: 100 },
                ],
            }));
            breaker.recordSpend(5);
            const state = breaker.getState();
            (0, vitest_1.expect)(state.windows[0].spent).toBe(5);
            (0, vitest_1.expect)(state.windows[1].spent).toBe(5);
        });
        (0, vitest_1.it)('totalSpent never resets when windows reset (totalSpent is monotonic)', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: { type: 'custom', durationMs: 1000 }, limit: 10 }],
            }));
            breaker.recordSpend(5);
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(5);
            // Advance past the window
            vitest_1.vi.advanceTimersByTime(1001);
            // Window spend resets, but totalSpent does not
            breaker.recordSpend(3);
            const state = breaker.getState();
            (0, vitest_1.expect)(state.windows[0].spent).toBe(3);
            (0, vitest_1.expect)(state.totalSpent).toBe(8);
        });
        (0, vitest_1.it)('fires onSpendRecorded hook', () => {
            const onSpendRecorded = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({ hooks: { onSpendRecorded } }));
            breaker.recordSpend(4);
            (0, vitest_1.expect)(onSpendRecorded).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(onSpendRecorded).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                cost: 4,
                totalSpent: 4,
            }));
        });
        (0, vitest_1.it)('fires onBudgetWarning hook when warning threshold is crossed', () => {
            const onBudgetWarning = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: 'hourly', limit: 10, warningThreshold: 0.5 }],
                hooks: { onBudgetWarning },
            }));
            breaker.recordSpend(4); // 40% — no warning
            (0, vitest_1.expect)(onBudgetWarning).not.toHaveBeenCalled();
            breaker.recordSpend(2); // 60% — crosses 50% threshold
            (0, vitest_1.expect)(onBudgetWarning).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(onBudgetWarning).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                window: 'hourly',
                warningThreshold: 0.5,
            }));
        });
        (0, vitest_1.it)('fires onOpen hook when circuit trips', () => {
            const onOpen = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({ hooks: { onOpen } }));
            breaker.recordSpend(11);
            (0, vitest_1.expect)(onOpen).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(onOpen).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                threshold: vitest_1.expect.objectContaining({ window: 'hourly', limit: 10 }),
                totalSpent: 11,
            }));
        });
    });
    // --- Task: recordTokens ---
    (0, vitest_1.describe)('recordTokens', () => {
        (0, vitest_1.it)('converts tokens to cost using pricing config', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                pricing: { inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
            }));
            breaker.recordTokens({ inputTokens: 1000, outputTokens: 500 });
            // input: 1000 * 3.0 / 1e6 = 0.003
            // output: 500 * 15.0 / 1e6 = 0.0075
            // total: 0.0105
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBeCloseTo(0.0105, 10);
        });
        (0, vitest_1.it)('throws if pricing is not configured', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            (0, vitest_1.expect)(() => breaker.recordTokens({ inputTokens: 100, outputTokens: 50 }))
                .toThrow('pricing must be configured to use recordTokens');
        });
    });
    // --- Task: getState ---
    (0, vitest_1.describe)('getState', () => {
        (0, vitest_1.it)('returns correct BreakerState shape', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const state = breaker.getState();
            (0, vitest_1.expect)(state).toHaveProperty('state', 'closed');
            (0, vitest_1.expect)(state).toHaveProperty('totalSpent', 0);
            (0, vitest_1.expect)(state).toHaveProperty('probesRemaining');
            (0, vitest_1.expect)(Array.isArray(state.windows)).toBe(true);
            (0, vitest_1.expect)(state.windows).toHaveLength(1);
            const w = state.windows[0];
            (0, vitest_1.expect)(w).toHaveProperty('window', 'hourly');
            (0, vitest_1.expect)(w).toHaveProperty('spent', 0);
            (0, vitest_1.expect)(w).toHaveProperty('limit', 10);
            (0, vitest_1.expect)(w).toHaveProperty('remaining', 10);
            (0, vitest_1.expect)(typeof w.resetsIn).toBe('number');
            (0, vitest_1.expect)(typeof w.windowStart).toBe('string');
            (0, vitest_1.expect)(typeof w.windowEnd).toBe('string');
            (0, vitest_1.expect)(w.breached).toBe(false);
            (0, vitest_1.expect)(Array.isArray(w.history)).toBe(true);
        });
        (0, vitest_1.it)('includes breachedThreshold when circuit is open', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11);
            const state = breaker.getState();
            (0, vitest_1.expect)(state.breachedThreshold).toBeDefined();
            (0, vitest_1.expect)(state.breachedThreshold?.window).toBe('hourly');
            (0, vitest_1.expect)(state.breachedThreshold?.limit).toBe(10);
        });
        (0, vitest_1.it)('breachedThreshold is undefined when circuit is closed', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const state = breaker.getState();
            (0, vitest_1.expect)(state.breachedThreshold).toBeUndefined();
        });
    });
    // --- Task: wouldExceedBudget ---
    (0, vitest_1.describe)('wouldExceedBudget', () => {
        (0, vitest_1.it)('returns true when estimated cost would breach any threshold', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(8);
            (0, vitest_1.expect)(breaker.wouldExceedBudget(3)).toBe(true); // 8 + 3 >= 10
        });
        (0, vitest_1.it)('returns false when cost fits within all budgets', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(3);
            (0, vitest_1.expect)(breaker.wouldExceedBudget(2)).toBe(false); // 3 + 2 < 10
        });
        (0, vitest_1.it)('does not modify state', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(5);
            const stateBefore = breaker.getState();
            breaker.wouldExceedBudget(20);
            const stateAfter = breaker.getState();
            (0, vitest_1.expect)(stateAfter.totalSpent).toBe(stateBefore.totalSpent);
            (0, vitest_1.expect)(stateAfter.windows[0].spent).toBe(stateBefore.windows[0].spent);
            (0, vitest_1.expect)(stateAfter.state).toBe(stateBefore.state);
        });
        (0, vitest_1.it)('returns true when cost exactly meets the limit', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(5);
            (0, vitest_1.expect)(breaker.wouldExceedBudget(5)).toBe(true); // 5 + 5 >= 10
        });
        (0, vitest_1.it)('returns false for estimated cost of 0', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(9);
            (0, vitest_1.expect)(breaker.wouldExceedBudget(0)).toBe(false); // 9 + 0 < 10
        });
    });
    // --- Task: reset ---
    (0, vitest_1.describe)('reset', () => {
        (0, vitest_1.it)('clears spend and closes circuit', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11);
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            breaker.reset();
            const state = breaker.getState();
            (0, vitest_1.expect)(state.state).toBe('closed');
            (0, vitest_1.expect)(state.windows[0].spent).toBe(0);
        });
        (0, vitest_1.it)('fires onClose hook when resetting from open state', () => {
            const onClose = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({ hooks: { onClose } }));
            breaker.recordSpend(11);
            breaker.reset();
            (0, vitest_1.expect)(onClose).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(onClose).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                previousState: 'open',
            }));
        });
        (0, vitest_1.it)('does not fire onClose hook when already closed', () => {
            const onClose = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({ hooks: { onClose } }));
            breaker.reset();
            (0, vitest_1.expect)(onClose).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('preserves totalSpent across resets', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(5);
            breaker.reset();
            // totalSpent is kept because it's the breaker's lifetime total;
            // windows reset but totalSpent does not go to zero.
            // Actually, looking at the implementation: reset only resets accumulators and machine.
            // totalSpent is intentionally never reset (monotonic counter).
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(5);
        });
    });
    // --- Task: addBudget ---
    (0, vitest_1.describe)('addBudget', () => {
        (0, vitest_1.it)('increases the limit for a window', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.addBudget('hourly', 5);
            (0, vitest_1.expect)(breaker.getState().windows[0].limit).toBe(15);
        });
        (0, vitest_1.it)('throws TypeError for non-positive amount', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            (0, vitest_1.expect)(() => breaker.addBudget('hourly', 0)).toThrow('amount must be positive');
            (0, vitest_1.expect)(() => breaker.addBudget('hourly', -5)).toThrow('amount must be positive');
        });
        (0, vitest_1.it)('throws TypeError for unrecognized window', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            (0, vitest_1.expect)(() => breaker.addBudget('daily', 5)).toThrow('Window not found in configured budgets');
        });
    });
    // --- Task: exportState ---
    (0, vitest_1.describe)('exportState', () => {
        (0, vitest_1.it)('returns a JSON-serializable object', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(3);
            const exported = breaker.exportState();
            (0, vitest_1.expect)(() => JSON.stringify(exported)).not.toThrow();
            (0, vitest_1.expect)(JSON.parse(JSON.stringify(exported))).toEqual(exported);
        });
        (0, vitest_1.it)('contains all required fields', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            const exported = breaker.exportState();
            (0, vitest_1.expect)(exported).toHaveProperty('windows');
            (0, vitest_1.expect)(exported).toHaveProperty('totalSpent');
            (0, vitest_1.expect)(exported).toHaveProperty('state');
            (0, vitest_1.expect)(exported).toHaveProperty('exportedAt');
            (0, vitest_1.expect)(typeof exported.exportedAt).toBe('string');
        });
        (0, vitest_1.it)('captures correct state when circuit is open', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11);
            const exported = breaker.exportState();
            (0, vitest_1.expect)(exported.state).toBe('open');
            (0, vitest_1.expect)(exported.totalSpent).toBe(11);
            (0, vitest_1.expect)(exported.windows[0].spent).toBe(11);
        });
    });
    // --- Task: Full lifecycle test ---
    (0, vitest_1.describe)('full lifecycle', () => {
        (0, vitest_1.it)('spend -> open -> fallback -> window reset -> half-open -> probe -> closed', async () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: { type: 'custom', durationMs: 10000 }, limit: 10 }],
                cooldownMs: 0, // no cooldown so we can test transitions cleanly
            }));
            const fn = vitest_1.vi.fn().mockResolvedValue('success');
            const wrapped = breaker.wrap(fn);
            // 1. Closed state: calls go through
            const result1 = await wrapped('call-1');
            (0, vitest_1.expect)(result1).toBe('success');
            (0, vitest_1.expect)(breaker.getState().state).toBe('closed');
            // 2. Record spend that breaches the budget
            breaker.recordSpend(11);
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            // 3. Wrapped calls are blocked (throw fallback by default)
            await (0, vitest_1.expect)(wrapped('call-2')).rejects.toThrow(budget_exceeded_error_1.BudgetExceededError);
            (0, vitest_1.expect)(fn).toHaveBeenCalledTimes(1); // only the first call went through
            // 4. Advance time past the custom window
            vitest_1.vi.advanceTimersByTime(10001);
            // 5. Next interaction triggers lazy reset -> half-open
            //    (window resets, spend drops to 0, which is below limit)
            const state3 = breaker.getState();
            (0, vitest_1.expect)(state3.state).toBe('half-open');
            (0, vitest_1.expect)(state3.windows[0].spent).toBe(0);
            // 6. Probe call goes through in half-open (probeCount defaults to 1)
            fn.mockResolvedValue('probe-success');
            const result3 = await wrapped('call-3');
            (0, vitest_1.expect)(result3).toBe('probe-success');
            // 7. After the probe, no more probes — but if no new breach, circuit should
            //    still be workable. The probe consumed the probe count but the circuit
            //    needs to transition to closed. We need to check this: probesRemaining = 0
            //    means next call should fallback, but since the window isn't breached,
            //    the state machine should close after probes complete.
            //
            //    Looking at the state machine: consumeProbe just decrements. The transition
            //    to closed happens externally. In the current implementation, after the probe
            //    call succeeds, no explicit close happens. The circuit transitions to closed
            //    only if we detect no breach.
            //
            //    For this test, since we have cooldownMs=0 and the window was reset,
            //    let's verify the probe consumed. The next call will see half-open with 0 probes
            //    and fall back.
            //
            //    But wait - after the window reset, spend is 0. If the probe call doesn't
            //    record any spend, then no budget is breached, but the machine is still in
            //    half-open with probesRemaining=0. In the current design, the machine doesn't
            //    auto-close after probes succeed — it requires explicit closing or another
            //    mechanism. Let's verify actual behavior:
            // After probe succeeds with no breach, circuit should auto-close
            const state4 = breaker.getState();
            (0, vitest_1.expect)(state4.state).toBe('closed');
        });
        (0, vitest_1.it)('spend -> open -> window reset -> half-open -> successful probe with no new breach closes circuit', async () => {
            // This is a cleaner lifecycle test
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: { type: 'custom', durationMs: 5000 }, limit: 5 }],
                cooldownMs: 0,
            }));
            // Breach the budget
            breaker.recordSpend(6);
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            // Advance past the window reset
            vitest_1.vi.advanceTimersByTime(5001);
            // Lazy reset triggers half-open
            (0, vitest_1.expect)(breaker.getState().state).toBe('half-open');
            // Make a probe call — no spend recorded, so budget stays unbreached
            const fn = vitest_1.vi.fn().mockResolvedValue('ok');
            const wrapped = breaker.wrap(fn);
            await wrapped('probe');
            (0, vitest_1.expect)(fn).toHaveBeenCalledOnce();
            // Circuit should auto-close after successful probe with no breach
            (0, vitest_1.expect)(breaker.getState().state).toBe('closed');
        });
    });
    // --- Additional edge cases ---
    (0, vitest_1.describe)('edge cases', () => {
        (0, vitest_1.it)('recordSpend when circuit is already open still tracks spend', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig());
            breaker.recordSpend(11); // breach, opens circuit
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            breaker.recordSpend(5); // additional spend while open
            (0, vitest_1.expect)(breaker.getState().totalSpent).toBe(16);
            (0, vitest_1.expect)(breaker.getState().windows[0].spent).toBe(16);
        });
        (0, vitest_1.it)('window with custom duration resets properly', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: { type: 'custom', durationMs: 2000 }, limit: 10 }],
            }));
            breaker.recordSpend(5);
            vitest_1.vi.advanceTimersByTime(2001);
            const state = breaker.getState();
            (0, vitest_1.expect)(state.windows[0].spent).toBe(0);
            (0, vitest_1.expect)(state.totalSpent).toBe(5);
        });
        (0, vitest_1.it)('onWindowReset hook fires when window expires', () => {
            const onWindowReset = vitest_1.vi.fn();
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [{ window: { type: 'custom', durationMs: 1000 }, limit: 10 }],
                hooks: { onWindowReset },
            }));
            breaker.recordSpend(7);
            vitest_1.vi.advanceTimersByTime(1001);
            // Trigger lazy check
            breaker.getState();
            (0, vitest_1.expect)(onWindowReset).toHaveBeenCalledWith({
                window: { type: 'custom', durationMs: 1000 },
                previousSpent: 7,
            });
        });
        (0, vitest_1.it)('multiple budgets: circuit opens when any threshold is breached', () => {
            const breaker = (0, breaker_1.createBreaker)(makeConfig({
                budgets: [
                    { window: 'hourly', limit: 10 },
                    { window: 'daily', limit: 100 },
                ],
            }));
            breaker.recordSpend(11); // exceeds hourly but not daily
            (0, vitest_1.expect)(breaker.getState().state).toBe('open');
            (0, vitest_1.expect)(breaker.getState().windows[0].breached).toBe(true);
            (0, vitest_1.expect)(breaker.getState().windows[1].breached).toBe(false);
        });
    });
});
//# sourceMappingURL=breaker.test.js.map