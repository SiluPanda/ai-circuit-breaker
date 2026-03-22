# ai-circuit-breaker

Spend-based circuit breaker for AI API calls.

[![npm version](https://img.shields.io/npm/v/ai-circuit-breaker.svg)](https://www.npmjs.com/package/ai-circuit-breaker)
[![npm downloads](https://img.shields.io/npm/dt/ai-circuit-breaker.svg)](https://www.npmjs.com/package/ai-circuit-breaker)
[![license](https://img.shields.io/npm/l/ai-circuit-breaker.svg)](https://github.com/SiluPanda/ai-circuit-breaker/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/ai-circuit-breaker.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

`ai-circuit-breaker` tracks cumulative costs from LLM API usage and automatically blocks further calls when spending exceeds configurable budget thresholds within defined time windows (hourly, daily, monthly, or custom durations). Unlike traditional circuit breakers that monitor error rates or latency, this package monitors money spent. A perfectly healthy API with 100% uptime can still bankrupt an engineering budget if an agent loop generates thousands of expensive calls in an hour -- no failure-based circuit breaker will catch that. This package does.

## Installation

```bash
npm install ai-circuit-breaker
```

## Quick Start

```typescript
import { createBreaker } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },   // $10/hour
    { window: 'daily', limit: 100 },    // $100/day
  ],
  fallback: { strategy: 'throw' },
});

// Wrap any async function that makes AI API calls
const safeChatCompletion = breaker.wrap(async (args) => {
  return await openai.chat.completions.create(args);
});

// Calls pass through when under budget
const response = await safeChatCompletion({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Record the cost of each call
breaker.recordSpend(0.03);

// Circuit opens when budget is exceeded -- fallback executes instead
```

## Features

- **Spend-based triggering** -- circuit opens when cumulative dollar spend exceeds a threshold, not on error counts or latency
- **Multiple simultaneous budgets** -- enforce hourly, daily, monthly, and custom-duration limits at the same time; any breach trips the circuit
- **Three-state circuit breaker** -- closed (normal), open (blocking), half-open (probe testing) with configurable cooldown and probe counts
- **Four fallback strategies** -- throw an error, return a cached response, downgrade to a cheaper model, or invoke a custom function
- **Automatic cost extraction** -- optionally extract cost from API responses via a `costExtractor` function
- **Token-to-cost conversion** -- record token usage directly with `recordTokens()` when pricing is configured
- **Pre-flight budget checks** -- `wouldExceedBudget()` lets you reject calls before they execute
- **Lifecycle hooks** -- `onOpen`, `onClose`, `onHalfOpen`, `onSpendRecorded`, `onBudgetWarning`, `onWindowReset`, `onExtractorError`
- **State export/import** -- persist breaker state across process restarts with `exportState()` and `initialState`
- **Budget replenishment** -- dynamically increase limits at runtime with `addBudget()`
- **Zero runtime dependencies** -- all logic uses built-in JavaScript APIs
- **Full TypeScript support** -- strict types with generics for argument and result types

## API Reference

### `createBreaker<TArgs, TResult>(config)`

Creates a circuit breaker instance.

```typescript
function createBreaker<TArgs = unknown, TResult = unknown>(
  config: BreakerConfig<TArgs, TResult>,
): Breaker<TArgs, TResult>;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `BreakerConfig<TArgs, TResult>` | Configuration object (see [BreakerConfig](#breakerconfig)) |

**Returns:** A `Breaker<TArgs, TResult>` instance.

**Throws:** `TypeError` if configuration is invalid (empty budgets, non-positive limit, invalid warningThreshold, non-positive probeCount, negative cooldownMs, or missing `fn` for downgrade/custom fallback strategies).

```typescript
import { createBreaker } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10, warningThreshold: 0.8 },
    { window: 'daily', limit: 100 },
    { window: 'monthly', limit: 1000 },
  ],
  fallback: { strategy: 'throw' },
  pricing: { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
  probeCount: 2,
  cooldownMs: 10000,
  maxHistorySize: 500,
  hooks: {
    onOpen: ({ threshold, totalSpent }) => {
      console.log(`Circuit opened: ${threshold.window} budget breached at $${threshold.spent}`);
    },
  },
});
```

---

### `Breaker` Interface

The object returned by `createBreaker`. All methods are available on this interface.

#### `breaker.wrap(fn)`

Wraps an async function with circuit-breaking logic. When the circuit is closed or half-open with remaining probes, calls pass through to `fn`. When the circuit is open (or half-open with no probes), the configured fallback executes instead.

```typescript
wrap(fn: (args: TArgs) => Promise<TResult>): (args: TArgs) => Promise<TResult>;
```

Multiple functions can be wrapped by the same breaker instance; they share the same spend state and circuit.

If a `costExtractor` is configured, it runs automatically on each successful result to record spend. If the `cached` fallback strategy is used, the most recent successful response is automatically cached.

```typescript
const safeCompletion = breaker.wrap(async (args) => {
  return await openai.chat.completions.create(args);
});

const safeEmbedding = breaker.wrap(async (args) => {
  return await openai.embeddings.create(args);
});

// Both share the same budget
const result = await safeCompletion({ model: 'gpt-4o', messages: [...] });
```

#### `breaker.recordSpend(cost)`

Records a dollar cost against all active budget windows. When cumulative spend in any window reaches or exceeds its limit, the circuit opens.

```typescript
recordSpend(cost: number): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `cost` | `number` | Dollar amount to record (must be >= 0) |

**Throws:** `TypeError` if `cost` is negative.

A cost of `0` is a no-op. Spend is recorded even when the circuit is already open (the total continues to accumulate).

```typescript
breaker.recordSpend(0.05);  // record $0.05
breaker.recordSpend(1.23);  // record $1.23
```

#### `breaker.recordTokens(usage)`

Converts token counts to a dollar cost using the configured `pricing` and records the spend. This is a convenience method that computes `(inputTokens * inputCostPer1M / 1,000,000) + (outputTokens * outputCostPer1M / 1,000,000)` and calls `recordSpend`.

```typescript
recordTokens(usage: { inputTokens: number; outputTokens: number }): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `usage.inputTokens` | `number` | Number of input tokens consumed |
| `usage.outputTokens` | `number` | Number of output tokens consumed |

**Throws:** `Error` if `pricing` was not provided in the config.

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  pricing: { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
});

// After receiving an API response with usage data:
breaker.recordTokens({ inputTokens: 1000, outputTokens: 500 });
// Records: (1000 * 3.00 / 1e6) + (500 * 15.00 / 1e6) = $0.0105
```

#### `breaker.getState()`

Returns the current state of the circuit breaker, including circuit state, total spend, per-window details, and probe information. This method triggers lazy window resets -- if any window has expired, it resets before building the state.

```typescript
getState(): BreakerState;
```

**Returns:** A `BreakerState` object.

```typescript
const state = breaker.getState();
// {
//   state: 'closed',
//   totalSpent: 5.50,
//   windows: [{
//     window: 'hourly',
//     spent: 5.50,
//     limit: 10,
//     remaining: 4.50,
//     resetsIn: 1800000,
//     windowStart: '2026-03-21T10:00:00.000Z',
//     windowEnd: '2026-03-21T11:00:00.000Z',
//     breached: false,
//     history: [{ cost: 5.50, timestamp: '2026-03-21T10:15:00.000Z' }],
//   }],
//   probesRemaining: 1,
//   breachedThreshold: undefined,
// }
```

#### `breaker.wouldExceedBudget(estimatedCost)`

Checks whether recording the given cost would breach any budget threshold. Does not modify state.

```typescript
wouldExceedBudget(estimatedCost: number): boolean;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `estimatedCost` | `number` | Estimated dollar cost of the upcoming call |

**Returns:** `true` if `currentSpent + estimatedCost >= limit` for any window.

```typescript
if (breaker.wouldExceedBudget(0.50)) {
  console.log('Skipping call -- would exceed budget');
} else {
  const result = await safeCompletion(args);
}
```

#### `breaker.reset()`

Manually resets all window spend counters and closes the circuit. The `totalSpent` counter is not reset -- it is a monotonic lifetime counter. Fires the `onClose` hook if the circuit was previously open or half-open.

```typescript
reset(): void;
```

```typescript
breaker.recordSpend(11);
console.log(breaker.getState().state); // 'open'

breaker.reset();
console.log(breaker.getState().state);      // 'closed'
console.log(breaker.getState().totalSpent); // 11 (totalSpent is monotonic)
```

#### `breaker.addBudget(window, amount)`

Dynamically increases the spending limit for a configured window. If the circuit is open and no budgets remain breached after the increase, the circuit transitions toward half-open.

```typescript
addBudget(window: WindowType | CustomWindow, amount: number): void;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `window` | `WindowType \| CustomWindow` | The window to replenish |
| `amount` | `number` | Dollar amount to add to the limit (must be > 0) |

**Throws:** `TypeError` if `amount` is not positive or the window is not found in configured budgets.

```typescript
// Original limit: $10/hour
breaker.addBudget('hourly', 5);
// New limit: $15/hour
```

#### `breaker.exportState()`

Exports the current breaker state as a JSON-serializable object. Use this to persist state across process restarts.

```typescript
exportState(): ExportedBreakerState;
```

**Returns:** An `ExportedBreakerState` with window states, total spend, circuit state, and an `exportedAt` ISO timestamp.

```typescript
const snapshot = breaker.exportState();
await fs.writeFile('breaker-state.json', JSON.stringify(snapshot));

// Later, restore it:
const saved = JSON.parse(await fs.readFile('breaker-state.json', 'utf-8'));
const breaker = createBreaker({
  budgets: [...],
  initialState: saved,
});
```

---

### `BudgetExceededError`

A custom error thrown when the circuit is open and the fallback strategy is `'throw'` (or `'cached'` with no cached response).

```typescript
class BudgetExceededError extends Error {
  readonly name: 'BudgetExceededError';
  readonly threshold: {
    window: WindowType | CustomWindow;
    limit: number;
    spent: number;
  };
  readonly resetsIn: number;       // ms until window resets
  readonly circuitState: CircuitState;
}
```

The `message` is human-readable:

```
Budget exceeded: spent $12.00 of $10.00 hourly budget. Circuit is open. Resets in 1800s.
```

```typescript
import { BudgetExceededError } from 'ai-circuit-breaker';

try {
  await safeChatCompletion(args);
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log(err.threshold);    // { window: 'hourly', limit: 10, spent: 12 }
    console.log(err.resetsIn);     // 1800000
    console.log(err.circuitState); // 'open'
  }
}
```

---

### `SpendTracker`

Tracks cumulative spend within a single budget window. Used internally but exported for advanced use cases.

```typescript
class SpendTracker {
  constructor(limit: number, warningThreshold?: number, maxHistorySize?: number);
  addSpend(cost: number): { breached: boolean; warningCrossed: boolean };
  getSpent(): number;
  getLimit(): number;
  setLimit(limit: number): void;
  getRemaining(): number;
  isBreached(): boolean;
  isWarningFired(): boolean;
  getHistory(): SpendEntry[];
  reset(): void;
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | -- | Budget limit in dollars |
| `warningThreshold` | `number` | `0.8` | Ratio (0-1) at which the warning fires |
| `maxHistorySize` | `number` | `1000` | Maximum spend entries retained |

---

### `StateMachine`

Manages the three-state circuit breaker transitions. Used internally but exported for advanced use cases.

```typescript
class StateMachine {
  constructor(probeCount?: number, cooldownMs?: number, initialState?: CircuitState);
  getState(): CircuitState;
  getBreachedThreshold(): BreachedThreshold | null;
  getProbesRemaining(): number;
  tripOpen(threshold: BreachedThreshold): void;
  tryTransitionToHalfOpen(now?: number): boolean;
  consumeProbe(): boolean;
  closeCircuit(): void;
  reset(): void;
  isCallAllowed(): boolean;
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `probeCount` | `number` | `1` | Number of probe calls allowed in half-open state |
| `cooldownMs` | `number` | `5000` | Minimum time (ms) the circuit stays open before transitioning to half-open |
| `initialState` | `CircuitState` | `'closed'` | Starting state |

---

### `FallbackHandler`

Executes the configured fallback strategy when the circuit is open. Used internally but exported for advanced use cases.

```typescript
class FallbackHandler<TArgs, TResult> {
  constructor(config: FallbackConfig<TArgs, TResult>);
  cacheResponse(response: TResult): void;
  execute(args: TArgs, context: FallbackContext): Promise<TResult>;
}
```

---

### Window Tracker Classes

All window trackers implement the `WindowTracker` interface:

```typescript
interface WindowTracker {
  getWindowStart(): string;       // ISO 8601 timestamp
  getWindowEnd(): string;         // ISO 8601 timestamp
  isExpired(now?: number): boolean;
  reset(now?: number): void;
  getResetsIn(now?: number): number; // ms until window end
}
```

#### `HourlyWindow`

Aligns to the top of the current UTC hour. Duration: 1 hour.

#### `DailyWindow`

Aligns to midnight UTC. Duration: 24 hours.

#### `MonthlyWindow`

Aligns to the 1st of the current UTC month at midnight. Duration: 1 calendar month. Handles February, leap years, and December-to-January rollovers.

#### `CustomDurationWindow`

Starts at creation time (or the provided `now` timestamp). Duration: the provided `durationMs`.

```typescript
new CustomDurationWindow(durationMs: number, now?: number);
```

#### `createWindowTracker(window, now?)`

Factory function that creates the appropriate `WindowTracker` based on the window config.

```typescript
function createWindowTracker(window: WindowType | CustomWindow, now?: number): WindowTracker;
```

**Throws:** `TypeError` for invalid window types.

---

## Configuration

### `BreakerConfig<TArgs, TResult>`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `budgets` | `BudgetThreshold[]` | **(required)** | One or more budget thresholds. Circuit opens when any is breached. |
| `fallback` | `FallbackConfig` | `{ strategy: 'throw' }` | What to do when the circuit is open. |
| `pricing` | `PricingConfig` | `undefined` | Token pricing for `recordTokens()`. |
| `costExtractor` | `(result: TResult) => number` | `undefined` | Extracts cost from each API response automatically. |
| `probeCount` | `number` | `1` | Number of probe calls allowed in half-open state. |
| `cooldownMs` | `number` | `5000` | Minimum ms the circuit stays open before transitioning to half-open. |
| `maxHistorySize` | `number` | `1000` | Maximum spend entries kept per window. |
| `timezone` | `string` | `undefined` | Reserved for future timezone-aware window alignment. |
| `initialState` | `ExportedBreakerState` | `undefined` | Restore state from a previous `exportState()` call. |
| `hooks` | `BreakerHooks` | `{}` | Lifecycle event callbacks. |

### `BudgetThreshold`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `window` | `WindowType \| CustomWindow` | **(required)** | Time window: `'hourly'`, `'daily'`, `'monthly'`, or `{ type: 'custom', durationMs: number }`. |
| `limit` | `number` | **(required)** | Maximum spend in dollars within the window. Must be positive. |
| `warningThreshold` | `number` | `0.8` | Ratio (0-1) at which `onBudgetWarning` fires. |

### `PricingConfig`

| Property | Type | Description |
|----------|------|-------------|
| `inputCostPer1M` | `number` | Cost in dollars per 1 million input tokens. |
| `outputCostPer1M` | `number` | Cost in dollars per 1 million output tokens. |

### `FallbackConfig`

A discriminated union with four strategies:

| Strategy | Type | Behavior |
|----------|------|----------|
| `'throw'` | `ThrowFallback` | Throws `BudgetExceededError`. |
| `'cached'` | `CachedFallback` | Returns the most recent successful response. Throws `BudgetExceededError` if no response has been cached yet. |
| `'downgrade'` | `DowngradeFallback<TArgs, TResult>` | Calls `fn(args)` -- typically a cheaper model. |
| `'custom'` | `CustomFallback<TArgs, TResult>` | Calls `fn(args, state)` with the full `BreakerState`. |

### `BreakerHooks`

All hooks are optional.

| Hook | Signature | Fires when |
|------|-----------|------------|
| `onOpen` | `(info: { threshold, totalSpent }) => void` | Circuit transitions to open. |
| `onClose` | `(info: { previousState, totalSpent }) => void` | Circuit transitions to closed (from open or half-open). |
| `onHalfOpen` | `(info: { reason, probeCount }) => void` | Circuit transitions to half-open. |
| `onSpendRecorded` | `(info: { cost, totalSpent, windows }) => void` | After every `recordSpend` call. |
| `onBudgetWarning` | `(info: { window, spent, limit, warningThreshold, percentUsed }) => void` | Spend crosses the warning threshold (fires once per window). |
| `onWindowReset` | `(info: { window, previousSpent }) => void` | A budget window expires and resets. |
| `onExtractorError` | `(info: { error, result }) => void` | The `costExtractor` throws an error. |

---

## Error Handling

### Budget exceeded

When the circuit is open and the fallback strategy is `'throw'`, wrapped calls throw a `BudgetExceededError`:

```typescript
import { BudgetExceededError } from 'ai-circuit-breaker';

try {
  await safeChatCompletion(args);
} catch (err) {
  if (err instanceof BudgetExceededError) {
    // err.threshold  -- { window, limit, spent }
    // err.resetsIn   -- ms until window resets
    // err.circuitState -- 'open' | 'half-open'
    console.log(`Over budget. Resets in ${Math.ceil(err.resetsIn / 1000)}s`);
  }
}
```

### Invalid configuration

`createBreaker` throws `TypeError` for:

- Empty or missing `budgets` array
- Non-positive `limit` values
- `warningThreshold` outside the range `[0, 1]`
- Non-positive `probeCount`
- Negative `cooldownMs`
- `'downgrade'` or `'custom'` fallback without a `fn`

### Pricing not configured

`recordTokens()` throws `Error` if `pricing` is not set in the config.

### Negative cost

`recordSpend()` throws `TypeError` if passed a negative number.

### Cost extractor errors

If the `costExtractor` function throws, the error is silently caught and the `onExtractorError` hook fires. The wrapped function still returns its result normally.

---

## Advanced Usage

### Multiple budget windows

Enforce hourly, daily, and monthly limits simultaneously. The circuit opens when **any** threshold is breached:

```typescript
const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10, warningThreshold: 0.8 },
    { window: 'daily', limit: 100, warningThreshold: 0.9 },
    { window: 'monthly', limit: 1000 },
  ],
  hooks: {
    onBudgetWarning: ({ window, percentUsed }) => {
      console.warn(`${window} budget at ${(percentUsed * 100).toFixed(0)}%`);
    },
  },
});
```

### Automatic cost extraction

Extract cost directly from the API response so you never forget to call `recordSpend`:

```typescript
const breaker = createBreaker<ChatCompletionRequest, ChatCompletionResponse>({
  budgets: [{ window: 'hourly', limit: 10 }],
  pricing: { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
  costExtractor: (response) => {
    const usage = response.usage;
    return (usage.prompt_tokens * 2.50 / 1_000_000)
         + (usage.completion_tokens * 10.00 / 1_000_000);
  },
});
```

### Downgrade to a cheaper model

When budget is exceeded, transparently fall back to a cheaper model:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => {
      return await openai.chat.completions.create({
        ...args,
        model: 'gpt-4o-mini', // cheaper model
      });
    },
  },
});
```

### Custom fallback with full state access

The `'custom'` strategy receives the full `BreakerState`, enabling sophisticated fallback logic:

```typescript
const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },
    { window: 'daily', limit: 100 },
  ],
  fallback: {
    strategy: 'custom',
    fn: async (args, state) => {
      if (state.windows[0].breached && !state.windows[1].breached) {
        // Hourly limit hit but daily is fine -- queue for later
        await queue.push(args);
        return { queued: true };
      }
      // Both limits hit -- return a degraded response
      return { error: 'Service at capacity', retryAfter: state.windows[0].resetsIn };
    },
  },
});
```

### Custom duration windows

Use a custom window for non-standard intervals:

```typescript
const breaker = createBreaker({
  budgets: [
    { window: { type: 'custom', durationMs: 15 * 60 * 1000 }, limit: 5 }, // $5 per 15 minutes
    { window: 'daily', limit: 100 },
  ],
});
```

### Persisting state across restarts

Export and restore breaker state to survive process restarts:

```typescript
// Before shutdown
const snapshot = breaker.exportState();
await redis.set('breaker:gpt4', JSON.stringify(snapshot));

// On startup
const saved = JSON.parse(await redis.get('breaker:gpt4'));
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  initialState: saved,
});
```

### Pre-flight budget checks

Reject expensive calls before they execute:

```typescript
import { promptPrice } from 'prompt-price'; // companion package

const estimatedCost = promptPrice(model, messages);

if (breaker.wouldExceedBudget(estimatedCost)) {
  return { error: 'Insufficient budget for this request' };
}

const result = await safeChatCompletion({ model, messages });
breaker.recordSpend(actualCost);
```

### Monitoring with hooks

Wire up observability for your circuit breaker:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 50 }],
  hooks: {
    onOpen: ({ threshold, totalSpent }) => {
      metrics.increment('circuit_breaker.opened');
      alerting.send(`Circuit opened: $${threshold.spent} of $${threshold.limit} ${threshold.window} budget`);
    },
    onClose: ({ previousState }) => {
      metrics.increment('circuit_breaker.closed');
    },
    onSpendRecorded: ({ cost, totalSpent, windows }) => {
      metrics.gauge('ai.spend.total', totalSpent);
      for (const w of windows) {
        metrics.gauge(`ai.spend.${w.window}.remaining`, w.remaining);
      }
    },
    onBudgetWarning: ({ window, percentUsed }) => {
      alerting.send(`${window} budget at ${(percentUsed * 100).toFixed(0)}%`);
    },
    onWindowReset: ({ window, previousSpent }) => {
      metrics.increment('circuit_breaker.window_reset');
    },
    onExtractorError: ({ error }) => {
      logger.error('Cost extractor failed', error);
    },
  },
});
```

### Dynamic budget replenishment

Increase a budget limit at runtime (e.g., after admin approval):

```typescript
breaker.recordSpend(11); // exceeds $10 hourly limit -- circuit opens
console.log(breaker.getState().state); // 'open'

breaker.addBudget('hourly', 10); // increase limit to $20
// If no budgets are still breached, circuit transitions toward half-open
```

---

## TypeScript

All types are exported and fully generic. The `TArgs` and `TResult` type parameters flow through `createBreaker`, `wrap`, and all fallback functions:

```typescript
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
  WindowTracker,
  FallbackContext,
  BreachedThreshold,
} from 'ai-circuit-breaker';

// Fully typed breaker
interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

interface ChatResponse {
  id: string;
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

const breaker = createBreaker<ChatRequest, ChatResponse>({
  budgets: [{ window: 'hourly', limit: 10 }],
  costExtractor: (response) => {
    return (response.usage.prompt_tokens * 2.50 / 1_000_000)
         + (response.usage.completion_tokens * 10.00 / 1_000_000);
  },
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => {
      // args is typed as ChatRequest
      return await cheapModel(args); // must return ChatResponse
    },
  },
});
```

## License

MIT
