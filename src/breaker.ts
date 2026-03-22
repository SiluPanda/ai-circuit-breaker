import type {
  BreakerConfig, Breaker, BreakerState, WindowState,
  WindowType, CustomWindow, ExportedBreakerState,
} from './types';
import { createWindowTracker } from './window/index';
import type { WindowTracker } from './window/types';
import { SpendTracker } from './spend-tracker';
import { StateMachine } from './state-machine';
import { FallbackHandler } from './fallback';
import type { FallbackContext } from './fallback';

interface BudgetEntry {
  window: WindowType | CustomWindow;
  tracker: WindowTracker;
  spend: SpendTracker;
}

export function createBreaker<TArgs = unknown, TResult = unknown>(
  config: BreakerConfig<TArgs, TResult>,
): Breaker<TArgs, TResult> {
  // --- Config validation ---
  if (!config.budgets || config.budgets.length === 0) {
    throw new TypeError('budgets must be a non-empty array');
  }
  for (const b of config.budgets) {
    if (b.limit <= 0) {
      throw new TypeError(`Budget limit must be positive, got ${b.limit}`);
    }
    if (b.warningThreshold !== undefined && (b.warningThreshold < 0 || b.warningThreshold > 1)) {
      throw new TypeError('warningThreshold must be between 0 and 1');
    }
  }
  if (config.probeCount !== undefined && config.probeCount <= 0) {
    throw new TypeError('probeCount must be positive');
  }
  if (config.cooldownMs !== undefined && config.cooldownMs < 0) {
    throw new TypeError('cooldownMs must be non-negative');
  }
  if (config.fallback?.strategy === 'downgrade' && !config.fallback.fn) {
    throw new TypeError('downgrade strategy requires fn');
  }
  if (config.fallback?.strategy === 'custom' && !config.fallback.fn) {
    throw new TypeError('custom strategy requires fn');
  }

  // --- Defaults ---
  const probeCount = config.probeCount ?? 1;
  const cooldownMs = config.cooldownMs ?? 5000;
  const maxHistorySize = config.maxHistorySize ?? 1000;
  const hooks = config.hooks ?? {};

  // --- Per-budget entries: one window tracker + one spend tracker per budget ---
  const entries: BudgetEntry[] = config.budgets.map(b => ({
    window: b.window,
    tracker: createWindowTracker(b.window),
    spend: new SpendTracker(b.limit, b.warningThreshold ?? 0.8, maxHistorySize),
  }));

  const machine = new StateMachine(probeCount, cooldownMs);
  const fallback = new FallbackHandler<TArgs, TResult>(config.fallback ?? { strategy: 'throw' });

  let totalSpent = 0;

  /** Check all windows for expiry; reset expired ones and fire hooks. */
  function lazyWindowReset(): void {
    for (const entry of entries) {
      if (entry.tracker.isExpired()) {
        const prevSpent = entry.spend.getSpent();
        entry.spend.reset();
        entry.tracker.reset();
        hooks.onWindowReset?.({ window: entry.window, previousSpent: prevSpent });
        // If circuit is open, a window reset may allow transition to half-open
        machine.tryTransitionToHalfOpen();
      }
    }
  }

  function buildWindowStates(): WindowState[] {
    return entries.map(e => ({
      window: e.window,
      spent: e.spend.getSpent(),
      limit: e.spend.getLimit(),
      remaining: e.spend.getRemaining(),
      resetsIn: e.tracker.getResetsIn(),
      windowStart: e.tracker.getWindowStart(),
      windowEnd: e.tracker.getWindowEnd(),
      breached: e.spend.isBreached(),
      history: e.spend.getHistory(),
    }));
  }

  function buildState(): BreakerState {
    const bt = machine.getBreachedThreshold();
    return {
      state: machine.getState(),
      totalSpent,
      windows: buildWindowStates(),
      probesRemaining: machine.getProbesRemaining(),
      breachedThreshold: bt ?? undefined,
    };
  }

  function getFallbackContext(): FallbackContext {
    const bt = machine.getBreachedThreshold();
    const threshold = bt ?? {
      window: entries[0].window,
      limit: entries[0].spend.getLimit(),
      spent: entries[0].spend.getSpent(),
    };
    return {
      threshold,
      resetsIn: entries[0].tracker.getResetsIn(),
      circuitState: machine.getState(),
      state: buildState(),
    };
  }

  const breaker: Breaker<TArgs, TResult> = {
    wrap(fn) {
      return async (args: TArgs) => {
        lazyWindowReset();

        if (!machine.isCallAllowed()) {
          return fallback.execute(args, getFallbackContext());
        }

        if (machine.getState() === 'half-open') {
          machine.consumeProbe();
        }

        const result = await fn(args);

        // Cache response for 'cached' fallback strategy
        if (config.fallback?.strategy === 'cached') {
          fallback.cacheResponse(result);
        }

        // Automatic cost extraction
        if (config.costExtractor) {
          try {
            const cost = config.costExtractor(result);
            if (!isNaN(cost) && cost > 0) {
              breaker.recordSpend(cost);
            }
          } catch (err) {
            hooks.onExtractorError?.({ error: err, result });
          }
        }

        // After successful probe, close circuit if all probes consumed and no budget breached
        if (machine.getState() === 'half-open' && machine.getProbesRemaining() === 0) {
          if (!entries.some(e => e.spend.isBreached())) {
            machine.closeCircuit();
            hooks.onClose?.({ previousState: 'half-open', totalSpent });
          }
        }

        return result;
      };
    },

    recordSpend(cost: number): void {
      if (cost < 0) throw new TypeError('cost must be non-negative');
      if (cost === 0) return;

      totalSpent += cost;
      lazyWindowReset();

      for (const entry of entries) {
        const { breached, warningCrossed } = entry.spend.addSpend(cost);

        if (warningCrossed) {
          const budgetDef = config.budgets.find(
            bd => JSON.stringify(bd.window) === JSON.stringify(entry.window),
          );
          hooks.onBudgetWarning?.({
            window: entry.window,
            spent: entry.spend.getSpent(),
            limit: entry.spend.getLimit(),
            warningThreshold: budgetDef?.warningThreshold ?? 0.8,
            percentUsed: entry.spend.getSpent() / entry.spend.getLimit(),
          });
        }

        if (breached && machine.getState() === 'closed') {
          const threshold = {
            window: entry.window,
            limit: entry.spend.getLimit(),
            spent: entry.spend.getSpent(),
          };
          machine.tripOpen(threshold);
          hooks.onOpen?.({ threshold, totalSpent });
        }
      }

      hooks.onSpendRecorded?.({
        cost,
        totalSpent,
        windows: entries.map(e => ({
          window: e.window,
          spent: e.spend.getSpent(),
          limit: e.spend.getLimit(),
          remaining: e.spend.getRemaining(),
        })),
      });
    },

    recordTokens(usage) {
      if (!config.pricing) {
        throw new Error('pricing must be configured to use recordTokens');
      }
      const cost =
        (usage.inputTokens * config.pricing.inputCostPer1M / 1_000_000) +
        (usage.outputTokens * config.pricing.outputCostPer1M / 1_000_000);
      breaker.recordSpend(cost);
    },

    getState(): BreakerState {
      lazyWindowReset();
      return buildState();
    },

    wouldExceedBudget(estimatedCost: number): boolean {
      lazyWindowReset();
      return entries.some(e => e.spend.getSpent() + estimatedCost >= e.spend.getLimit());
    },

    reset(): void {
      const previousState = machine.getState();
      for (const entry of entries) {
        entry.spend.reset();
        entry.tracker.reset();
      }
      machine.reset();
      if (previousState !== 'closed') {
        hooks.onClose?.({ previousState: previousState as 'open' | 'half-open', totalSpent });
      }
    },

    addBudget(window, amount) {
      if (amount <= 0) throw new TypeError('amount must be positive');
      const entry = entries.find(e => JSON.stringify(e.window) === JSON.stringify(window));
      if (!entry) throw new TypeError('Window not found in configured budgets');
      entry.spend.setLimit(entry.spend.getLimit() + amount);
      // If circuit is open and no budgets are breached now, try transition
      if (machine.getState() === 'open' && !entries.some(e => e.spend.isBreached())) {
        machine.tryTransitionToHalfOpen();
      }
    },

    exportState(): ExportedBreakerState {
      return {
        windows: entries.map(e => ({
          window: e.window,
          spent: e.spend.getSpent(),
          windowStart: e.tracker.getWindowStart(),
          windowEnd: e.tracker.getWindowEnd(),
        })),
        totalSpent,
        state: machine.getState(),
        exportedAt: new Date().toISOString(),
      };
    },
  };

  return breaker;
}
