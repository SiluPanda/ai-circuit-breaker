import type { FallbackConfig, BreakerState, CircuitState, WindowType, CustomWindow } from './types';
import { BudgetExceededError } from './budget-exceeded-error';

export interface FallbackContext {
  threshold: { window: WindowType | CustomWindow; limit: number; spent: number };
  resetsIn: number;
  circuitState: CircuitState;
  state: BreakerState;
}

export class FallbackHandler<TArgs = unknown, TResult = unknown> {
  private cachedResponse: TResult | undefined = undefined;
  private hasCachedResponse = false;

  constructor(private readonly config: FallbackConfig<TArgs, TResult>) {}

  /** Cache the latest successful response (for 'cached' strategy). */
  cacheResponse(response: TResult): void {
    this.cachedResponse = response;
    this.hasCachedResponse = true;
  }

  /** Execute the fallback strategy. */
  async execute(args: TArgs, context: FallbackContext): Promise<TResult> {
    switch (this.config.strategy) {
      case 'throw':
        throw new BudgetExceededError(context.threshold, context.resetsIn, context.circuitState);

      case 'cached':
        if (this.hasCachedResponse) return this.cachedResponse as TResult;
        throw new BudgetExceededError(context.threshold, context.resetsIn, context.circuitState);

      case 'downgrade':
        return this.config.fn(args);

      case 'custom':
        return this.config.fn(args, context.state);
    }
  }
}
