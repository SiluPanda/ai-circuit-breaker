"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('WindowType', () => {
    (0, vitest_1.it)('accepts hourly, daily, monthly', () => {
        const hourly = 'hourly';
        const daily = 'daily';
        const monthly = 'monthly';
        (0, vitest_1.expect)(hourly).toBe('hourly');
        (0, vitest_1.expect)(daily).toBe('daily');
        (0, vitest_1.expect)(monthly).toBe('monthly');
    });
    (0, vitest_1.it)('has exactly 3 valid values', () => {
        const values = ['hourly', 'daily', 'monthly'];
        (0, vitest_1.expect)(values).toHaveLength(3);
    });
});
(0, vitest_1.describe)('CustomWindow', () => {
    (0, vitest_1.it)('has type custom and durationMs', () => {
        const win = { type: 'custom', durationMs: 900000 };
        (0, vitest_1.expect)(win.type).toBe('custom');
        (0, vitest_1.expect)(win.durationMs).toBe(900000);
    });
});
(0, vitest_1.describe)('BudgetThreshold', () => {
    (0, vitest_1.it)('has window and limit fields', () => {
        const threshold = {
            window: 'hourly',
            limit: 10,
        };
        (0, vitest_1.expect)(threshold.window).toBe('hourly');
        (0, vitest_1.expect)(threshold.limit).toBe(10);
        (0, vitest_1.expect)(threshold.warningThreshold).toBeUndefined();
    });
    (0, vitest_1.it)('accepts optional warningThreshold', () => {
        const threshold = {
            window: 'daily',
            limit: 100,
            warningThreshold: 0.9,
        };
        (0, vitest_1.expect)(threshold.warningThreshold).toBe(0.9);
    });
    (0, vitest_1.it)('accepts CustomWindow as the window field', () => {
        const threshold = {
            window: { type: 'custom', durationMs: 60000 },
            limit: 5,
        };
        (0, vitest_1.expect)(typeof threshold.window).toBe('object');
        if (typeof threshold.window === 'object') {
            (0, vitest_1.expect)(threshold.window.type).toBe('custom');
            (0, vitest_1.expect)(threshold.window.durationMs).toBe(60000);
        }
    });
});
(0, vitest_1.describe)('FallbackConfig variants', () => {
    (0, vitest_1.it)('ThrowFallback has strategy throw', () => {
        const fb = { strategy: 'throw' };
        (0, vitest_1.expect)(fb.strategy).toBe('throw');
    });
    (0, vitest_1.it)('CachedFallback has strategy cached', () => {
        const fb = { strategy: 'cached' };
        (0, vitest_1.expect)(fb.strategy).toBe('cached');
    });
    (0, vitest_1.it)('DowngradeFallback has strategy downgrade and fn', () => {
        const fb = {
            strategy: 'downgrade',
            fn: async (args) => `downgraded: ${args}`,
        };
        (0, vitest_1.expect)(fb.strategy).toBe('downgrade');
        (0, vitest_1.expect)(typeof fb.fn).toBe('function');
    });
    (0, vitest_1.it)('CustomFallback has strategy custom and fn with state', () => {
        const fb = {
            strategy: 'custom',
            fn: async () => 'custom result',
        };
        (0, vitest_1.expect)(fb.strategy).toBe('custom');
        (0, vitest_1.expect)(typeof fb.fn).toBe('function');
    });
    (0, vitest_1.it)('FallbackConfig union accepts all 4 variants', () => {
        const configs = [
            { strategy: 'throw' },
            { strategy: 'cached' },
            { strategy: 'downgrade', fn: async (a) => a },
            {
                strategy: 'custom',
                fn: async () => 'result',
            },
        ];
        (0, vitest_1.expect)(configs).toHaveLength(4);
        (0, vitest_1.expect)(configs[0].strategy).toBe('throw');
        (0, vitest_1.expect)(configs[1].strategy).toBe('cached');
        (0, vitest_1.expect)(configs[2].strategy).toBe('downgrade');
        (0, vitest_1.expect)(configs[3].strategy).toBe('custom');
    });
});
(0, vitest_1.describe)('PricingConfig', () => {
    (0, vitest_1.it)('has inputCostPer1M and outputCostPer1M', () => {
        const pricing = {
            inputCostPer1M: 3.0,
            outputCostPer1M: 15.0,
        };
        (0, vitest_1.expect)(pricing.inputCostPer1M).toBe(3.0);
        (0, vitest_1.expect)(pricing.outputCostPer1M).toBe(15.0);
    });
});
(0, vitest_1.describe)('BreakerConfig', () => {
    (0, vitest_1.it)('requires budgets; all others are optional', () => {
        const config = {
            budgets: [{ window: 'hourly', limit: 10 }],
        };
        (0, vitest_1.expect)(config.budgets).toHaveLength(1);
        (0, vitest_1.expect)(config.fallback).toBeUndefined();
        (0, vitest_1.expect)(config.pricing).toBeUndefined();
        (0, vitest_1.expect)(config.costExtractor).toBeUndefined();
        (0, vitest_1.expect)(config.probeCount).toBeUndefined();
        (0, vitest_1.expect)(config.cooldownMs).toBeUndefined();
        (0, vitest_1.expect)(config.maxHistorySize).toBeUndefined();
        (0, vitest_1.expect)(config.timezone).toBeUndefined();
        (0, vitest_1.expect)(config.initialState).toBeUndefined();
        (0, vitest_1.expect)(config.hooks).toBeUndefined();
    });
    (0, vitest_1.it)('accepts all optional fields', () => {
        const config = {
            budgets: [
                { window: 'hourly', limit: 10 },
                { window: 'daily', limit: 100 },
            ],
            fallback: { strategy: 'throw' },
            pricing: { inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
            costExtractor: (result) => result.cost,
            probeCount: 3,
            cooldownMs: 10000,
            maxHistorySize: 500,
            timezone: 'America/New_York',
            hooks: {},
        };
        (0, vitest_1.expect)(config.budgets).toHaveLength(2);
        (0, vitest_1.expect)(config.fallback?.strategy).toBe('throw');
        (0, vitest_1.expect)(config.pricing?.inputCostPer1M).toBe(3.0);
        (0, vitest_1.expect)(typeof config.costExtractor).toBe('function');
        (0, vitest_1.expect)(config.probeCount).toBe(3);
        (0, vitest_1.expect)(config.cooldownMs).toBe(10000);
        (0, vitest_1.expect)(config.maxHistorySize).toBe(500);
        (0, vitest_1.expect)(config.timezone).toBe('America/New_York');
        (0, vitest_1.expect)(config.hooks).toEqual({});
    });
});
(0, vitest_1.describe)('CircuitState', () => {
    (0, vitest_1.it)('accepts closed, open, half-open', () => {
        const closed = 'closed';
        const open = 'open';
        const halfOpen = 'half-open';
        (0, vitest_1.expect)(closed).toBe('closed');
        (0, vitest_1.expect)(open).toBe('open');
        (0, vitest_1.expect)(halfOpen).toBe('half-open');
    });
    (0, vitest_1.it)('has exactly 3 valid values', () => {
        const values = ['closed', 'open', 'half-open'];
        (0, vitest_1.expect)(values).toHaveLength(3);
    });
});
(0, vitest_1.describe)('SpendEntry', () => {
    (0, vitest_1.it)('has cost and timestamp', () => {
        const entry = {
            cost: 0.05,
            timestamp: '2026-03-21T10:00:00.000Z',
        };
        (0, vitest_1.expect)(entry.cost).toBe(0.05);
        (0, vitest_1.expect)(entry.timestamp).toBe('2026-03-21T10:00:00.000Z');
    });
});
(0, vitest_1.describe)('WindowState', () => {
    (0, vitest_1.it)('has all required fields', () => {
        const ws = {
            window: 'hourly',
            spent: 5.50,
            limit: 10,
            remaining: 4.50,
            resetsIn: 1800000,
            windowStart: '2026-03-21T10:00:00.000Z',
            windowEnd: '2026-03-21T11:00:00.000Z',
            breached: false,
            history: [{ cost: 5.50, timestamp: '2026-03-21T10:15:00.000Z' }],
        };
        (0, vitest_1.expect)(ws.window).toBe('hourly');
        (0, vitest_1.expect)(ws.spent).toBe(5.50);
        (0, vitest_1.expect)(ws.limit).toBe(10);
        (0, vitest_1.expect)(ws.remaining).toBe(4.50);
        (0, vitest_1.expect)(ws.resetsIn).toBe(1800000);
        (0, vitest_1.expect)(ws.windowStart).toBe('2026-03-21T10:00:00.000Z');
        (0, vitest_1.expect)(ws.windowEnd).toBe('2026-03-21T11:00:00.000Z');
        (0, vitest_1.expect)(ws.breached).toBe(false);
        (0, vitest_1.expect)(ws.history).toHaveLength(1);
    });
    (0, vitest_1.it)('accepts CustomWindow as window field', () => {
        const ws = {
            window: { type: 'custom', durationMs: 60000 },
            spent: 0,
            limit: 5,
            remaining: 5,
            resetsIn: 60000,
            windowStart: '2026-03-21T10:00:00.000Z',
            windowEnd: '2026-03-21T10:01:00.000Z',
            breached: false,
            history: [],
        };
        (0, vitest_1.expect)(typeof ws.window).toBe('object');
        if (typeof ws.window === 'object') {
            (0, vitest_1.expect)(ws.window.durationMs).toBe(60000);
        }
    });
});
(0, vitest_1.describe)('BreakerState', () => {
    (0, vitest_1.it)('has all required fields', () => {
        const state = {
            state: 'closed',
            totalSpent: 5.50,
            windows: [],
            probesRemaining: 1,
        };
        (0, vitest_1.expect)(state.state).toBe('closed');
        (0, vitest_1.expect)(state.totalSpent).toBe(5.50);
        (0, vitest_1.expect)(state.windows).toEqual([]);
        (0, vitest_1.expect)(state.probesRemaining).toBe(1);
        (0, vitest_1.expect)(state.breachedThreshold).toBeUndefined();
    });
    (0, vitest_1.it)('accepts optional breachedThreshold when open', () => {
        const state = {
            state: 'open',
            totalSpent: 12.00,
            windows: [],
            probesRemaining: 0,
            breachedThreshold: {
                window: 'hourly',
                limit: 10,
                spent: 12.00,
            },
        };
        (0, vitest_1.expect)(state.breachedThreshold?.window).toBe('hourly');
        (0, vitest_1.expect)(state.breachedThreshold?.limit).toBe(10);
        (0, vitest_1.expect)(state.breachedThreshold?.spent).toBe(12.00);
    });
});
(0, vitest_1.describe)('ExportedBreakerState', () => {
    (0, vitest_1.it)('has all required fields', () => {
        const exported = {
            windows: [
                {
                    window: 'hourly',
                    spent: 5.50,
                    windowStart: '2026-03-21T10:00:00.000Z',
                    windowEnd: '2026-03-21T11:00:00.000Z',
                },
            ],
            totalSpent: 5.50,
            state: 'closed',
            exportedAt: '2026-03-21T10:30:00.000Z',
        };
        (0, vitest_1.expect)(exported.windows).toHaveLength(1);
        (0, vitest_1.expect)(exported.totalSpent).toBe(5.50);
        (0, vitest_1.expect)(exported.state).toBe('closed');
        (0, vitest_1.expect)(exported.exportedAt).toBe('2026-03-21T10:30:00.000Z');
    });
    (0, vitest_1.it)('is JSON-serializable', () => {
        const exported = {
            windows: [
                {
                    window: { type: 'custom', durationMs: 60000 },
                    spent: 3.00,
                    windowStart: '2026-03-21T10:00:00.000Z',
                    windowEnd: '2026-03-21T10:01:00.000Z',
                },
            ],
            totalSpent: 3.00,
            state: 'open',
            exportedAt: '2026-03-21T10:00:30.000Z',
        };
        const json = JSON.stringify(exported);
        const parsed = JSON.parse(json);
        (0, vitest_1.expect)(parsed.totalSpent).toBe(3.00);
        (0, vitest_1.expect)(parsed.state).toBe('open');
        (0, vitest_1.expect)(parsed.windows[0].window).toEqual({ type: 'custom', durationMs: 60000 });
    });
});
(0, vitest_1.describe)('BreakerHooks', () => {
    (0, vitest_1.it)('all hooks are optional — empty object is valid', () => {
        const hooks = {};
        (0, vitest_1.expect)(hooks.onOpen).toBeUndefined();
        (0, vitest_1.expect)(hooks.onClose).toBeUndefined();
        (0, vitest_1.expect)(hooks.onHalfOpen).toBeUndefined();
        (0, vitest_1.expect)(hooks.onSpendRecorded).toBeUndefined();
        (0, vitest_1.expect)(hooks.onBudgetWarning).toBeUndefined();
        (0, vitest_1.expect)(hooks.onWindowReset).toBeUndefined();
        (0, vitest_1.expect)(hooks.onExtractorError).toBeUndefined();
    });
    (0, vitest_1.it)('accepts all hooks as functions', () => {
        const hooks = {
            onOpen: () => { },
            onClose: () => { },
            onHalfOpen: () => { },
            onSpendRecorded: () => { },
            onBudgetWarning: () => { },
            onWindowReset: () => { },
            onExtractorError: () => { },
        };
        (0, vitest_1.expect)(typeof hooks.onOpen).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onClose).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onHalfOpen).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onSpendRecorded).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onBudgetWarning).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onWindowReset).toBe('function');
        (0, vitest_1.expect)(typeof hooks.onExtractorError).toBe('function');
    });
});
(0, vitest_1.describe)('Breaker interface', () => {
    (0, vitest_1.it)('can be mock-implemented with all 8 methods', () => {
        const mockState = {
            state: 'closed',
            totalSpent: 0,
            windows: [],
            probesRemaining: 1,
        };
        const mockExported = {
            windows: [],
            totalSpent: 0,
            state: 'closed',
            exportedAt: '2026-03-21T10:00:00.000Z',
        };
        const breaker = {
            wrap: (fn) => fn,
            recordSpend: () => { },
            recordTokens: () => { },
            getState: () => mockState,
            wouldExceedBudget: () => false,
            reset: () => { },
            addBudget: () => { },
            exportState: () => mockExported,
        };
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
//# sourceMappingURL=types.test.js.map