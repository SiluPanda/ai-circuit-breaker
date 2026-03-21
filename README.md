# ai-circuit-breaker

Spend-based circuit breaker for AI API calls. Automatically trips when your AI API spending exceeds configurable budget thresholds, protecting against runaway costs.

## Installation

```bash
npm install ai-circuit-breaker
```

## Quick Start

> **Note:** `createBreaker` is not yet implemented. The following shows the planned API.

```typescript
import { createBreaker } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },   // $10/hour
    { window: 'daily', limit: 100 },    // $100/day
  ],
  fallback: { strategy: 'throw' },
  pricing: {
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
  },
});

const safeChatCompletion = breaker.wrap(async (args) => {
  return await openai.chat.completions.create(args);
});

// Calls pass through when under budget
const response = await safeChatCompletion({ model: 'gpt-4o', messages: [...] });

// Circuit opens when budget is exceeded — fallback executes instead
```

## Available Types

- `WindowType` — `'hourly' | 'daily' | 'monthly'`
- `CustomWindow` — Custom duration window with `durationMs`
- `BudgetThreshold` — Budget limit for a specific time window
- `FallbackConfig` — Union of `ThrowFallback`, `CachedFallback`, `DowngradeFallback`, `CustomFallback`
- `PricingConfig` — Token pricing for automatic cost calculation
- `BreakerConfig` — Full configuration for `createBreaker`
- `CircuitState` — `'closed' | 'open' | 'half-open'`
- `BreakerState` — Current state of the circuit breaker
- `ExportedBreakerState` — Serializable state for persistence
- `BreakerHooks` — Event hooks for monitoring circuit breaker activity
- `Breaker` — The circuit breaker instance interface

## BudgetExceededError

Thrown when the circuit is open and the fallback strategy is `'throw'`.

```typescript
import { BudgetExceededError } from 'ai-circuit-breaker';

try {
  await safeChatCompletion(args);
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log(err.threshold);    // { window, limit, spent }
    console.log(err.resetsIn);     // milliseconds until window resets
    console.log(err.circuitState); // 'open' | 'half-open'
  }
}
```

## License

MIT
