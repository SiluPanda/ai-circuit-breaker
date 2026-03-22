"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const budget_exceeded_error_1 = require("../budget-exceeded-error");
(0, vitest_1.describe)('BudgetExceededError', () => {
    (0, vitest_1.it)('extends Error', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'hourly', limit: 10, spent: 12 }, 1800000, 'open');
        (0, vitest_1.expect)(err instanceof Error).toBe(true);
    });
    (0, vitest_1.it)('has correct name BudgetExceededError', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'hourly', limit: 10, spent: 12 }, 1800000, 'open');
        (0, vitest_1.expect)(err.name).toBe('BudgetExceededError');
    });
    (0, vitest_1.it)('contains threshold, resetsIn, and circuitState properties', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'daily', limit: 100, spent: 105.50 }, 43200000, 'open');
        (0, vitest_1.expect)(err.threshold).toEqual({ window: 'daily', limit: 100, spent: 105.50 });
        (0, vitest_1.expect)(err.resetsIn).toBe(43200000);
        (0, vitest_1.expect)(err.circuitState).toBe('open');
    });
    (0, vitest_1.it)('produces a human-readable message with WindowType', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'hourly', limit: 10, spent: 12 }, 1800000, 'open');
        (0, vitest_1.expect)(err.message).toBe('Budget exceeded: spent $12.00 of $10.00 hourly budget. Circuit is open. Resets in 1800s.');
    });
    (0, vitest_1.it)('produces a human-readable message with CustomWindow', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: { type: 'custom', durationMs: 900000 }, limit: 5, spent: 6.50 }, 450000, 'half-open');
        (0, vitest_1.expect)(err.message).toBe('Budget exceeded: spent $6.50 of $5.00 custom(900000ms) budget. Circuit is half-open. Resets in 450s.');
    });
    (0, vitest_1.it)('instanceof check works correctly', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'monthly', limit: 1000, spent: 1200 }, 86400000, 'open');
        (0, vitest_1.expect)(err instanceof budget_exceeded_error_1.BudgetExceededError).toBe(true);
        (0, vitest_1.expect)(err instanceof Error).toBe(true);
    });
    (0, vitest_1.it)('has a stack trace', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'hourly', limit: 10, spent: 12 }, 1800000, 'open');
        (0, vitest_1.expect)(err.stack).toBeDefined();
    });
    (0, vitest_1.it)('rounds resetsIn up to nearest second in message', () => {
        const err = new budget_exceeded_error_1.BudgetExceededError({ window: 'hourly', limit: 10, spent: 12 }, 1500, 'open');
        (0, vitest_1.expect)(err.message).toContain('Resets in 2s.');
    });
});
//# sourceMappingURL=budget-exceeded-error.test.js.map