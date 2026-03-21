import { describe, it, expect } from 'vitest';
import { BudgetExceededError } from '../budget-exceeded-error';

describe('BudgetExceededError', () => {
  it('extends Error', () => {
    const err = new BudgetExceededError(
      { window: 'hourly', limit: 10, spent: 12 },
      1800000,
      'open',
    );
    expect(err instanceof Error).toBe(true);
  });

  it('has correct name BudgetExceededError', () => {
    const err = new BudgetExceededError(
      { window: 'hourly', limit: 10, spent: 12 },
      1800000,
      'open',
    );
    expect(err.name).toBe('BudgetExceededError');
  });

  it('contains threshold, resetsIn, and circuitState properties', () => {
    const err = new BudgetExceededError(
      { window: 'daily', limit: 100, spent: 105.50 },
      43200000,
      'open',
    );
    expect(err.threshold).toEqual({ window: 'daily', limit: 100, spent: 105.50 });
    expect(err.resetsIn).toBe(43200000);
    expect(err.circuitState).toBe('open');
  });

  it('produces a human-readable message with WindowType', () => {
    const err = new BudgetExceededError(
      { window: 'hourly', limit: 10, spent: 12 },
      1800000,
      'open',
    );
    expect(err.message).toBe(
      'Budget exceeded: spent $12.00 of $10.00 hourly budget. Circuit is open. Resets in 1800s.'
    );
  });

  it('produces a human-readable message with CustomWindow', () => {
    const err = new BudgetExceededError(
      { window: { type: 'custom', durationMs: 900000 }, limit: 5, spent: 6.50 },
      450000,
      'half-open',
    );
    expect(err.message).toBe(
      'Budget exceeded: spent $6.50 of $5.00 custom(900000ms) budget. Circuit is half-open. Resets in 450s.'
    );
  });

  it('instanceof check works correctly', () => {
    const err = new BudgetExceededError(
      { window: 'monthly', limit: 1000, spent: 1200 },
      86400000,
      'open',
    );
    expect(err instanceof BudgetExceededError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('has a stack trace', () => {
    const err = new BudgetExceededError(
      { window: 'hourly', limit: 10, spent: 12 },
      1800000,
      'open',
    );
    expect(err.stack).toBeDefined();
  });

  it('rounds resetsIn up to nearest second in message', () => {
    const err = new BudgetExceededError(
      { window: 'hourly', limit: 10, spent: 12 },
      1500,
      'open',
    );
    expect(err.message).toContain('Resets in 2s.');
  });
});
