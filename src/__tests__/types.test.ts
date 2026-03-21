import { describe, it, expect } from 'vitest';
import type {
  WindowType,
  CustomWindow,
  BudgetThreshold,
  ThrowFallback,
  CachedFallback,
  DowngradeFallback,
  CustomFallback,
  FallbackConfig,
  PricingConfig,
  BreakerConfig,
  CircuitState,
  SpendEntry,
  WindowState,
  BreakerState,
  ExportedBreakerState,
  BreakerHooks,
  Breaker,
} from '../types';

describe('WindowType', () => {
  it('accepts hourly, daily, monthly', () => {
    const hourly: WindowType = 'hourly';
    const daily: WindowType = 'daily';
    const monthly: WindowType = 'monthly';
    expect(hourly).toBe('hourly');
    expect(daily).toBe('daily');
    expect(monthly).toBe('monthly');
  });

  it('has exactly 3 valid values', () => {
    const values: WindowType[] = ['hourly', 'daily', 'monthly'];
    expect(values).toHaveLength(3);
  });
});

describe('CustomWindow', () => {
  it('has type custom and durationMs', () => {
    const win: CustomWindow = { type: 'custom', durationMs: 900000 };
    expect(win.type).toBe('custom');
    expect(win.durationMs).toBe(900000);
  });
});

describe('BudgetThreshold', () => {
  it('has window and limit fields', () => {
    const threshold: BudgetThreshold = {
      window: 'hourly',
      limit: 10,
    };
    expect(threshold.window).toBe('hourly');
    expect(threshold.limit).toBe(10);
    expect(threshold.warningThreshold).toBeUndefined();
  });

  it('accepts optional warningThreshold', () => {
    const threshold: BudgetThreshold = {
      window: 'daily',
      limit: 100,
      warningThreshold: 0.9,
    };
    expect(threshold.warningThreshold).toBe(0.9);
  });

  it('accepts CustomWindow as the window field', () => {
    const threshold: BudgetThreshold = {
      window: { type: 'custom', durationMs: 60000 },
      limit: 5,
    };
    expect(typeof threshold.window).toBe('object');
    if (typeof threshold.window === 'object') {
      expect(threshold.window.type).toBe('custom');
      expect(threshold.window.durationMs).toBe(60000);
    }
  });
});

describe('FallbackConfig variants', () => {
  it('ThrowFallback has strategy throw', () => {
    const fb: ThrowFallback = { strategy: 'throw' };
    expect(fb.strategy).toBe('throw');
  });

  it('CachedFallback has strategy cached', () => {
    const fb: CachedFallback = { strategy: 'cached' };
    expect(fb.strategy).toBe('cached');
  });

  it('DowngradeFallback has strategy downgrade and fn', () => {
    const fb: DowngradeFallback<string, string> = {
      strategy: 'downgrade',
      fn: async (args) => `downgraded: ${args}`,
    };
    expect(fb.strategy).toBe('downgrade');
    expect(typeof fb.fn).toBe('function');
  });

  it('CustomFallback has strategy custom and fn with state', () => {
    const fb: CustomFallback<string, string> = {
      strategy: 'custom',
      fn: async () => 'custom result',
    };
    expect(fb.strategy).toBe('custom');
    expect(typeof fb.fn).toBe('function');
  });

  it('FallbackConfig union accepts all 4 variants', () => {
    const configs: FallbackConfig<string, string>[] = [
      { strategy: 'throw' },
      { strategy: 'cached' },
      { strategy: 'downgrade', fn: async (a) => a },
      {
        strategy: 'custom',
        fn: async () => 'result',
      },
    ];
    expect(configs).toHaveLength(4);
    expect(configs[0].strategy).toBe('throw');
    expect(configs[1].strategy).toBe('cached');
    expect(configs[2].strategy).toBe('downgrade');
    expect(configs[3].strategy).toBe('custom');
  });
});

describe('PricingConfig', () => {
  it('has inputCostPer1M and outputCostPer1M', () => {
    const pricing: PricingConfig = {
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
    };
    expect(pricing.inputCostPer1M).toBe(3.0);
    expect(pricing.outputCostPer1M).toBe(15.0);
  });
});

describe('BreakerConfig', () => {
  it('requires budgets; all others are optional', () => {
    const config: BreakerConfig = {
      budgets: [{ window: 'hourly', limit: 10 }],
    };
    expect(config.budgets).toHaveLength(1);
    expect(config.fallback).toBeUndefined();
    expect(config.pricing).toBeUndefined();
    expect(config.costExtractor).toBeUndefined();
    expect(config.probeCount).toBeUndefined();
    expect(config.cooldownMs).toBeUndefined();
    expect(config.maxHistorySize).toBeUndefined();
    expect(config.timezone).toBeUndefined();
    expect(config.initialState).toBeUndefined();
    expect(config.hooks).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const config: BreakerConfig<string, { cost: number }> = {
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
    expect(config.budgets).toHaveLength(2);
    expect(config.fallback?.strategy).toBe('throw');
    expect(config.pricing?.inputCostPer1M).toBe(3.0);
    expect(typeof config.costExtractor).toBe('function');
    expect(config.probeCount).toBe(3);
    expect(config.cooldownMs).toBe(10000);
    expect(config.maxHistorySize).toBe(500);
    expect(config.timezone).toBe('America/New_York');
    expect(config.hooks).toEqual({});
  });
});

describe('CircuitState', () => {
  it('accepts closed, open, half-open', () => {
    const closed: CircuitState = 'closed';
    const open: CircuitState = 'open';
    const halfOpen: CircuitState = 'half-open';
    expect(closed).toBe('closed');
    expect(open).toBe('open');
    expect(halfOpen).toBe('half-open');
  });

  it('has exactly 3 valid values', () => {
    const values: CircuitState[] = ['closed', 'open', 'half-open'];
    expect(values).toHaveLength(3);
  });
});

describe('SpendEntry', () => {
  it('has cost and timestamp', () => {
    const entry: SpendEntry = {
      cost: 0.05,
      timestamp: '2026-03-21T10:00:00.000Z',
    };
    expect(entry.cost).toBe(0.05);
    expect(entry.timestamp).toBe('2026-03-21T10:00:00.000Z');
  });
});

describe('WindowState', () => {
  it('has all required fields', () => {
    const ws: WindowState = {
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
    expect(ws.window).toBe('hourly');
    expect(ws.spent).toBe(5.50);
    expect(ws.limit).toBe(10);
    expect(ws.remaining).toBe(4.50);
    expect(ws.resetsIn).toBe(1800000);
    expect(ws.windowStart).toBe('2026-03-21T10:00:00.000Z');
    expect(ws.windowEnd).toBe('2026-03-21T11:00:00.000Z');
    expect(ws.breached).toBe(false);
    expect(ws.history).toHaveLength(1);
  });

  it('accepts CustomWindow as window field', () => {
    const ws: WindowState = {
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
    expect(typeof ws.window).toBe('object');
    if (typeof ws.window === 'object') {
      expect(ws.window.durationMs).toBe(60000);
    }
  });
});

describe('BreakerState', () => {
  it('has all required fields', () => {
    const state: BreakerState = {
      state: 'closed',
      totalSpent: 5.50,
      windows: [],
      probesRemaining: 1,
    };
    expect(state.state).toBe('closed');
    expect(state.totalSpent).toBe(5.50);
    expect(state.windows).toEqual([]);
    expect(state.probesRemaining).toBe(1);
    expect(state.breachedThreshold).toBeUndefined();
  });

  it('accepts optional breachedThreshold when open', () => {
    const state: BreakerState = {
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
    expect(state.breachedThreshold?.window).toBe('hourly');
    expect(state.breachedThreshold?.limit).toBe(10);
    expect(state.breachedThreshold?.spent).toBe(12.00);
  });
});

describe('ExportedBreakerState', () => {
  it('has all required fields', () => {
    const exported: ExportedBreakerState = {
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
    expect(exported.windows).toHaveLength(1);
    expect(exported.totalSpent).toBe(5.50);
    expect(exported.state).toBe('closed');
    expect(exported.exportedAt).toBe('2026-03-21T10:30:00.000Z');
  });

  it('is JSON-serializable', () => {
    const exported: ExportedBreakerState = {
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
    const parsed = JSON.parse(json) as ExportedBreakerState;
    expect(parsed.totalSpent).toBe(3.00);
    expect(parsed.state).toBe('open');
    expect(parsed.windows[0].window).toEqual({ type: 'custom', durationMs: 60000 });
  });
});

describe('BreakerHooks', () => {
  it('all hooks are optional — empty object is valid', () => {
    const hooks: BreakerHooks = {};
    expect(hooks.onOpen).toBeUndefined();
    expect(hooks.onClose).toBeUndefined();
    expect(hooks.onHalfOpen).toBeUndefined();
    expect(hooks.onSpendRecorded).toBeUndefined();
    expect(hooks.onBudgetWarning).toBeUndefined();
    expect(hooks.onWindowReset).toBeUndefined();
    expect(hooks.onExtractorError).toBeUndefined();
  });

  it('accepts all hooks as functions', () => {
    const hooks: BreakerHooks = {
      onOpen: () => {},
      onClose: () => {},
      onHalfOpen: () => {},
      onSpendRecorded: () => {},
      onBudgetWarning: () => {},
      onWindowReset: () => {},
      onExtractorError: () => {},
    };
    expect(typeof hooks.onOpen).toBe('function');
    expect(typeof hooks.onClose).toBe('function');
    expect(typeof hooks.onHalfOpen).toBe('function');
    expect(typeof hooks.onSpendRecorded).toBe('function');
    expect(typeof hooks.onBudgetWarning).toBe('function');
    expect(typeof hooks.onWindowReset).toBe('function');
    expect(typeof hooks.onExtractorError).toBe('function');
  });
});

describe('Breaker interface', () => {
  it('can be mock-implemented with all 8 methods', () => {
    const mockState: BreakerState = {
      state: 'closed',
      totalSpent: 0,
      windows: [],
      probesRemaining: 1,
    };

    const mockExported: ExportedBreakerState = {
      windows: [],
      totalSpent: 0,
      state: 'closed',
      exportedAt: '2026-03-21T10:00:00.000Z',
    };

    const breaker: Breaker<string, string> = {
      wrap: (fn) => fn,
      recordSpend: () => {},
      recordTokens: () => {},
      getState: () => mockState,
      wouldExceedBudget: () => false,
      reset: () => {},
      addBudget: () => {},
      exportState: () => mockExported,
    };

    expect(typeof breaker.wrap).toBe('function');
    expect(typeof breaker.recordSpend).toBe('function');
    expect(typeof breaker.recordTokens).toBe('function');
    expect(typeof breaker.getState).toBe('function');
    expect(typeof breaker.wouldExceedBudget).toBe('function');
    expect(typeof breaker.reset).toBe('function');
    expect(typeof breaker.addBudget).toBe('function');
    expect(typeof breaker.exportState).toBe('function');
  });
});
