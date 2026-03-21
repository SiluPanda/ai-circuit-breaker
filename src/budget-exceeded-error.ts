import { CircuitState, WindowType, CustomWindow } from './types';

export class BudgetExceededError extends Error {
  readonly name = 'BudgetExceededError';

  constructor(
    readonly threshold: {
      window: WindowType | CustomWindow;
      limit: number;
      spent: number;
    },
    readonly resetsIn: number,
    readonly circuitState: CircuitState,
  ) {
    const windowLabel = typeof threshold.window === 'string'
      ? threshold.window
      : `custom(${threshold.window.durationMs}ms)`;
    super(
      `Budget exceeded: spent $${threshold.spent.toFixed(2)} of $${threshold.limit.toFixed(2)} ${windowLabel} budget. ` +
      `Circuit is ${circuitState}. Resets in ${Math.ceil(resetsIn / 1000)}s.`
    );
    Object.setPrototypeOf(this, BudgetExceededError.prototype);
  }
}
