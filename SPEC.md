# ai-circuit-breaker -- Specification

## 1. Overview

`ai-circuit-breaker` is a spend-based circuit breaker for AI API calls. It tracks cumulative costs from LLM API usage and automatically blocks further calls when spending exceeds configurable budget thresholds within defined time windows (hourly, daily, monthly, or custom). The circuit breaker follows the standard three-state pattern -- closed (normal), open (blocking), half-open (testing) -- but the trigger is not error rate or failure count. The trigger is money spent. When cumulative spend crosses a threshold, the circuit opens and all subsequent API calls are blocked until the budget window resets or the budget is explicitly replenished.

The gap this package fills is specific and well-defined. Existing circuit breaker libraries -- `opossum`, Netflix Hystrix (JVM), `cockatiel`, and the circuit breaker in `tool-call-retry` -- all operate on failure signals: error counts, error rates, timeout rates, or response time degradation. They answer the question "is this service healthy enough to keep calling?" `ai-circuit-breaker` answers a different question entirely: "can we afford to keep calling this service?" A perfectly healthy API with 100% uptime and sub-100ms latency can still bankrupt an engineering budget if an agent loop generates thousands of GPT-4 calls in an hour. No failure-based circuit breaker will catch this because nothing is failing -- the API is happily accepting requests and charging money for every one.

The cost management gap in the AI tooling ecosystem is real and growing. LLM APIs charge per token (input and output), and costs scale with model capability: GPT-4o costs ~$2.50/$10.00 per million input/output tokens, Claude Opus costs ~$15/$75 per million tokens, and pricing varies across dozens of models and providers. An uncontrolled agent loop, a recursive tool call chain, a prompt that accidentally includes a 100KB context -- any of these can produce a multi-hundred-dollar API bill in minutes. Rate limiters (like `mcp-rate-guard` or `bottleneck`) control request volume, not cost. A single request with a large context window can cost more than a thousand small requests. Cost control requires tracking actual dollar amounts, not request counts.

`ai-circuit-breaker` provides a `createBreaker` function that returns a breaker instance configured with budget thresholds, time windows, and fallback strategies. The breaker wraps an AI client (any function that makes API calls) and intercepts each call. Before the call, it checks whether the accumulated spend within the current window exceeds the threshold; if so, it blocks the call and executes a fallback (return a cached response, downgrade to a cheaper model, throw an error, or invoke a custom fallback function). After each successful call, the caller records the cost via `breaker.recordSpend(cost)`, which updates the cumulative total. When the time window resets (e.g., the top of the next hour for an hourly budget), the spend counter resets and the circuit closes automatically.

The half-open state serves a specific purpose in the spend-based context: when the circuit has been open because the budget was exhausted, and the window has partially elapsed, the breaker transitions to half-open to allow a small number of probe calls through. These probes serve two purposes: (1) check whether the budget has been externally replenished (e.g., an admin increased the budget mid-cycle), and (2) allow critical operations to proceed with controlled spend. If the probe calls stay within budget, the circuit closes. If the probes push spend back over the threshold, the circuit reopens.

The package composes with other packages in this monorepo. `model-price-registry` provides per-model pricing data (cost per input token, cost per output token) used to calculate the dollar cost of each API call. `prompt-price` estimates the cost of a prompt before sending it, enabling pre-flight budget checks. `token-fence` enforces token budgets at the prompt level (truncation, context management), which reduces per-call cost but does not track cumulative spend. `ai-chargeback` tags and allocates costs by team, project, or feature -- it needs to know total spend, which `ai-circuit-breaker` tracks. `tool-call-retry` provides error-based circuit breaking for tool functions -- a complementary concern. `ai-circuit-breaker` handles spend-based circuit breaking for the AI calls themselves.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `createBreaker(config)` function that returns a spend-based circuit breaker instance with configurable budget thresholds, time windows, and fallback strategies.
- Provide a `breaker.wrap(fn)` method that wraps an async function (typically an AI API call) with spend-based circuit breaking, returning a new function with the same signature.
- Provide a `breaker.recordSpend(cost)` method that records the cost of a completed API call, updating the cumulative spend total for the current window.
- Track cumulative spend across multiple budget windows simultaneously (e.g., $5/hour AND $50/day AND $500/month), opening the circuit when any threshold is breached.
- Implement the three-state circuit breaker pattern (closed/open/half-open) adapted for spend-based triggering: closed allows all calls, open blocks all calls and invokes fallback, half-open allows limited probe calls to test whether budget has been replenished or a new window has started.
- Support configurable budget windows: per-hour, per-day, per-month, and custom durations. Windows align to clock boundaries by default (top of the hour, midnight UTC, first of the month) with configurable alignment.
- Support multiple fallback strategies when the circuit is open: throw an error, return a cached response, downgrade to a cheaper model via a caller-provided function, or invoke a custom fallback function.
- Provide `breaker.getState()` returning the current circuit state, cumulative spend, remaining budget, time until window reset, and spend history.
- Provide `breaker.reset()` to manually reset the spend counter and close the circuit.
- Emit events on state transitions and spend recording: `onOpen`, `onClose`, `onHalfOpen`, `onSpendRecorded`, `onBudgetWarning`, `onWindowReset`.
- Support pre-flight cost estimation: if the caller provides an estimated cost before the call, the breaker can reject calls that would exceed the budget without executing them.
- Keep runtime dependencies to zero. All spend tracking, window management, state transitions, and timer logic use built-in JavaScript APIs.

### Non-Goals

- **Not a failure-based circuit breaker.** This package does not monitor error rates, timeout rates, or response time degradation. It monitors money spent. For error-based circuit breaking, use the circuit breaker in `tool-call-retry` or `opossum`. The two are complementary -- a service can be down (error-based breaker opens) or too expensive (spend-based breaker opens), and both conditions should block calls.
- **Not a rate limiter.** This package does not limit how many requests per second or per minute can be made. It limits how much money can be spent. A single expensive request can trip the breaker; a thousand cheap requests might not. For request-rate limiting, use `bottleneck` or `mcp-rate-guard`.
- **Not a token counter.** This package does not count tokens in prompts or responses. It accepts dollar amounts (or fractional dollar amounts) reported by the caller. The caller is responsible for computing the cost, either by reading `usage` fields from API responses or by using `prompt-price` / `model-price-registry` for estimation.
- **Not a billing system.** This package tracks spend within budget windows for circuit-breaking purposes. It does not generate invoices, store historical spending data beyond the current window, or integrate with payment providers. For cost allocation and reporting, use `ai-chargeback`.
- **Not a proxy or middleware.** This package wraps async functions. It does not intercept HTTP traffic, modify request headers, or sit between the application and the API at the network level.
- **Not a multi-tenant budget manager.** This package manages a single budget scope (one set of thresholds per breaker instance). For per-team or per-project budgets, create separate breaker instances or use `ai-chargeback` for allocation tracking.
- **Not a persistent store.** Spend data is held in memory. If the process restarts, spend counters reset to zero. The caller can persist and restore state via `breaker.exportState()` and `createBreaker({ initialState })` if cross-restart tracking is needed.

---

## 3. Target Users and Use Cases

### AI Application Developers

Developers building applications that make LLM API calls and need to prevent runaway costs. A chatbot that uses GPT-4o for every response might be fine at 100 users but catastrophic at 10,000 users during a traffic spike. `ai-circuit-breaker` wraps the API client so that when hourly spend hits $50, the circuit opens and subsequent calls either fall back to a cheaper model (GPT-4o-mini) or return a graceful "service temporarily at capacity" message. A typical integration is: `const breaker = createBreaker({ budgets: [{ window: 'hourly', limit: 50 }] })`.

### Agent and Autonomous System Developers

Developers building autonomous agents where an LLM generates tool calls that trigger further LLM calls. Without spend control, a reasoning loop that calls Claude Opus 10 times per user query at $0.50 per call can burn $500 in an hour with only 100 concurrent users. Agents are particularly dangerous because the human is not in the loop approving each API call -- the agent decides how many calls to make. `ai-circuit-breaker` provides a hard budget ceiling that the agent cannot exceed, regardless of how many calls it decides to generate.

### Platform and Infrastructure Teams

Teams operating shared AI infrastructure where multiple applications share an API key or account. A single misbehaving application can consume the entire monthly budget before other applications get any allocation. Platform teams deploy one breaker per application (or per team) with independent budget thresholds, ensuring fair resource allocation and preventing any single consumer from exhausting the shared budget.

### Startup and Small Team Developers

Developers with limited AI API budgets who cannot afford a surprise $2,000 bill from a bug in their code. `ai-circuit-breaker` acts as a financial safety net: set a daily budget of $20, and the worst-case surprise bill is $20 plus whatever was spent on the calls already in flight when the breaker tripped.

### Cost-Aware Microservice Architectures

Teams building microservices where each service makes independent AI API calls. Without centralized cost control, the aggregate spend across 15 microservices is invisible until the end-of-month bill arrives. Each microservice deploys its own breaker with a per-service budget allocation, providing decentralized cost governance.

---

## 4. Core Concepts

### Spend-Based Circuit Breaking

Traditional circuit breakers monitor failures. `ai-circuit-breaker` monitors spend. The fundamental unit is a dollar amount (represented as a number, where 1.0 = $1.00). Every API call's cost is recorded via `breaker.recordSpend(cost)`, and the cumulative total within each active budget window is compared against the configured threshold. When cumulative spend exceeds any threshold, the circuit opens.

This is a fundamentally different signal than error rate. A service can be 100% available with zero errors and still trigger the spend-based breaker. Conversely, a service can be returning errors (which cost nothing, since failed API calls are typically not billed) and the spend-based breaker remains closed. The two types of circuit breakers -- error-based and spend-based -- are orthogonal and composable: an AI API call can be wrapped with both `tool-call-retry` (for error resilience) and `ai-circuit-breaker` (for cost control).

### Budget Thresholds

A budget threshold is a pair of `(window, limit)` where `window` defines the time period and `limit` defines the maximum spend (in dollars) allowed within that period. A breaker can have multiple simultaneous thresholds:

```typescript
const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },    // $10 per hour
    { window: 'daily', limit: 100 },     // $100 per day
    { window: 'monthly', limit: 1000 },  // $1000 per month
  ],
});
```

The circuit opens when **any** threshold is breached. A burst of expensive calls might hit the hourly limit without approaching the daily limit. Sustained moderate spend might hit the daily limit without ever triggering the hourly limit. Multiple thresholds provide defense in depth.

### Budget Windows

A budget window defines the time period over which spend is accumulated before the counter resets. Built-in windows align to natural clock boundaries by default:

| Window | Duration | Default Alignment | Reset Behavior |
|---|---|---|---|
| `hourly` | 60 minutes | Top of the hour (XX:00:00 UTC) | Counter resets when the current hour ends. |
| `daily` | 24 hours | Midnight UTC (00:00:00 UTC) | Counter resets at midnight UTC. |
| `monthly` | Calendar month | First of the month, midnight UTC | Counter resets on the 1st of the next month. |
| `custom` | Caller-defined duration in milliseconds | Aligned to breaker creation time | Counter resets after the specified duration elapses. |

When a window resets, the cumulative spend for that window returns to zero. If the circuit was open solely because that window's threshold was breached, and no other threshold is breached, the circuit transitions from open to closed (or to half-open, depending on configuration).

### Circuit Breaker States

The three states follow the standard circuit breaker pattern, adapted for spend-based triggers:

**Closed (normal operation):** All API calls pass through. Each completed call's cost is recorded. The breaker monitors cumulative spend against each budget threshold. When spend exceeds any threshold, the circuit transitions to open. This is the steady-state for healthy, within-budget operation.

**Open (blocking):** API calls are blocked. The wrapped function does not execute the original API call. Instead, it executes the configured fallback strategy (throw an error, return cached data, downgrade to a cheaper model, or run a custom function). The circuit remains open until one of: (1) the budget window that triggered the opening resets (time-based), (2) the budget is manually replenished via `breaker.addBudget(amount)`, or (3) the circuit is manually reset via `breaker.reset()`. When a potential reopening condition occurs (window reset or budget replenishment), the circuit transitions to half-open.

**Half-open (testing):** A limited number of API calls are allowed through to verify that the budget situation has changed. The breaker allows `probeCount` calls (default: 1) to execute. If those calls complete and the cumulative spend (including the probe costs) remains below all thresholds, the circuit transitions to closed. If the probe costs push spend back over any threshold, the circuit transitions back to open. Half-open also serves as a grace period during window transitions: when an hourly window resets, the breaker transitions to half-open rather than immediately closed, to prevent a stampede of queued calls from immediately exhausting the new window's budget.

### Spend Tracking

Spend is tracked as a running total (a floating-point number representing dollars) per budget window. The breaker maintains one accumulator per active budget window. When `breaker.recordSpend(cost)` is called:

1. The cost is added to every active window's accumulator.
2. Each accumulator is compared against its window's threshold.
3. If any accumulator exceeds its threshold and the circuit is closed, the circuit transitions to open.
4. The `onSpendRecorded` event fires with the cost and updated totals.
5. If any accumulator crosses a warning threshold (default: 80% of the limit), the `onBudgetWarning` event fires.

Spend recording is synchronous and non-blocking. It does not involve async operations, timers, or I/O. The cost is simply added to in-memory counters.

### Cost Accumulation from API Responses

The breaker itself does not parse API responses. The caller is responsible for extracting the cost and calling `recordSpend`. This is deliberate: cost calculation varies across providers, models, and pricing tiers. The typical pattern is:

```typescript
const response = await wrappedClient.chat({ model: 'gpt-4o', messages });
const inputCost = response.usage.prompt_tokens * (2.50 / 1_000_000);
const outputCost = response.usage.completion_tokens * (10.00 / 1_000_000);
breaker.recordSpend(inputCost + outputCost);
```

For convenience, the breaker supports an `autoRecord` mode where a cost-extraction function is provided at configuration time. In this mode, the wrapped function's return value is passed through the extractor, and the cost is recorded automatically:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  costExtractor: (response) => {
    const usage = response.usage;
    return usage.prompt_tokens * (2.50 / 1_000_000)
         + usage.completion_tokens * (10.00 / 1_000_000);
  },
});
```

### Fallback Strategies

When the circuit is open and a call is blocked, the breaker executes a fallback instead. Four strategies are supported:

| Strategy | Behavior | When to Use |
|---|---|---|
| `throw` (default) | Throws a `BudgetExceededError` with details about the breached threshold, current spend, and time until window reset. | When the caller has its own error handling for budget exhaustion. |
| `cached` | Returns a previously cached successful response. The cache stores the last successful response from the wrapped function. | When stale data is acceptable and the application can function with a slightly outdated response. |
| `downgrade` | Calls a caller-provided fallback function instead of the original. Typically used to call a cheaper model. | When the application can degrade gracefully to a less capable but cheaper alternative. |
| `custom` | Calls a caller-provided function that receives the original arguments and the breaker state, and returns any value. | When the fallback logic is complex or context-dependent. |

---

## 5. Circuit Breaker States

### State Diagram

```
                    budget replenished /
                    window reset
              ┌────────────────────────────┐
              │                            │
              ▼                            │
         ┌─────────┐  spend exceeds   ┌──────────┐
         │ CLOSED  │  threshold       │  OPEN    │
         │ (normal)│ ────────────────>│(blocking)│
         └─────────┘                  └────┬─────┘
              ▲                            │
              │                            │ window reset /
              │                            │ budget replenished
              │                            ▼
              │  probe spend          ┌──────────┐
              │  within budget        │HALF-OPEN │
              └──────────────────────│(testing) │
                                      └────┬─────┘
                                           │
                   probe spend exceeds     │
                   threshold               │
                          ┌────────────────┘
                          │
                          ▼
                     ┌──────────┐
                     │  OPEN    │
                     │(blocking)│
                     └──────────┘
```

### Closed State

The circuit is closed during normal operation. Every call passes through to the underlying function. After each call, the caller records the cost via `recordSpend`. The breaker accumulates spend per window and compares against thresholds.

**Transitions out:**
- **To open:** Cumulative spend in any budget window exceeds its threshold. The transition is triggered inside `recordSpend`, not during the call itself. This means the call that caused the breach completes successfully (the money is already spent), and the *next* call is blocked.

**Behavior during closed state:**
- `wrap`ped function executes the original function normally.
- `recordSpend` adds cost to all window accumulators.
- `getState()` returns `{ state: 'closed', ... }`.

### Open State

The circuit is open. No API calls pass through. Every call to the wrapped function executes the fallback strategy.

**Transitions out:**
- **To half-open:** A budget window resets (time-based), budget is manually replenished (`addBudget`), or the `cooldownMs` timer expires. The transition is checked lazily -- when the next call arrives, the breaker checks whether any transition condition has been met. There is no background timer polling.

**Behavior during open state:**
- `wrap`ped function does not execute the original function. Executes fallback strategy instead.
- `recordSpend` is a no-op (the wrapped function did not execute, so no cost was incurred from it; however, the method is still callable for manual recording if the caller made a call through a different path).
- `getState()` returns `{ state: 'open', ... }` with information about which threshold was breached and time until window reset.

### Half-Open State

The circuit is testing whether the budget situation has improved. A limited number of calls are allowed through.

**Transitions out:**
- **To closed:** The allowed probe calls complete and cumulative spend (including probe costs) remains below all thresholds.
- **To open:** A probe call's cost pushes cumulative spend back over any threshold, or a probe call fails to complete within the expected cost envelope.

**Behavior during half-open state:**
- The first `probeCount` calls pass through to the original function. Additional calls beyond `probeCount` execute the fallback strategy.
- `recordSpend` adds cost to all window accumulators. After each probe's cost is recorded, thresholds are re-evaluated.
- Probes are tracked by a counter that resets when the circuit transitions out of half-open.

---

## 6. Budget Windows

### Hourly Window

Accumulates spend from the start of the current UTC hour to the end. At the top of the next hour, the accumulator resets to zero.

**Example:** If the breaker is created at 14:37 UTC with an hourly limit of $10, the first window runs from 14:00 to 15:00 UTC. At 15:00, the counter resets. Spend recorded at 14:38 and 14:59 are in the same window; spend recorded at 15:01 is in the next window.

**Alignment:** By default, hourly windows align to the top of the hour. The `alignTo` option can set a custom alignment: `alignTo: 30` starts windows at XX:30:00 UTC.

### Daily Window

Accumulates spend from midnight UTC to the next midnight UTC.

**Alignment:** By default, aligns to midnight UTC. The `timezone` option shifts alignment: `timezone: 'America/New_York'` aligns to midnight Eastern time.

### Monthly Window

Accumulates spend from the first of the current month (midnight UTC) to the first of the next month.

**Alignment:** Always starts on the 1st. The `timezone` option shifts alignment.

### Custom Window

Accumulates spend over a fixed duration specified in milliseconds. The window starts when the breaker is created (or when the previous window ended) and resets after the duration elapses.

```typescript
const breaker = createBreaker({
  budgets: [
    { window: { type: 'custom', durationMs: 15 * 60 * 1000 }, limit: 5 },  // $5 per 15 minutes
  ],
});
```

Custom windows do not align to clock boundaries. They are rolling durations anchored to the breaker's creation time or the previous reset.

### Window Reset Mechanics

When a window resets:

1. The spend accumulator for that window is set to zero.
2. If the circuit is open and the reset window was the one that caused the opening (i.e., the breached threshold belongs to the reset window), and no other window's threshold is currently breached, the circuit transitions to half-open.
3. The `onWindowReset` event fires with the window type and the spend total at the time of reset.

Window resets are evaluated lazily. There is no background `setInterval` checking whether a window has elapsed. Instead, when the next call arrives (via the wrapped function or via `getState()`), the breaker checks whether any window has expired since the last check. If so, it performs the reset. This design avoids keeping timers alive that prevent Node.js process exit and avoids unnecessary CPU work when the breaker is idle.

### Simultaneous Windows

A breaker can have multiple budget windows active simultaneously. Each window maintains its own independent accumulator. `recordSpend` adds the cost to all accumulators. The circuit opens when any single accumulator exceeds its threshold. The circuit closes only when all accumulators are below their thresholds.

This means a breaker with both hourly ($10) and daily ($100) budgets can be in a state where the hourly budget is exhausted but the daily budget is fine. At the top of the next hour, the hourly accumulator resets, the circuit transitions to half-open, and if spending stays within the new hour's budget, the circuit closes -- even though the daily accumulator still reflects the spend from all previous hours.

---

## 7. Spend Tracking

### Recording Spend

The primary mechanism for tracking cost is `breaker.recordSpend(cost: number)`:

```typescript
const response = await wrappedApiCall(args);
breaker.recordSpend(0.0023); // $0.0023 for this call
```

The `cost` parameter is a positive number representing dollars (or any consistent currency unit -- the breaker does not care about currency, only that the units are consistent between `recordSpend` calls and the `limit` in budget configurations).

Calling `recordSpend` with a negative number throws a `TypeError`. Calling it with zero is a no-op.

### Automatic Cost Extraction

When a `costExtractor` function is provided, the breaker automatically records spend after each successful call through the wrapped function:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  costExtractor: (response) => {
    return response.usage.total_tokens * (5.0 / 1_000_000);
  },
});

const wrappedCall = breaker.wrap(originalApiCall);
const response = await wrappedCall(args); // Cost is recorded automatically
```

The `costExtractor` receives the return value of the wrapped function and must return a number. If it throws, the error is caught, the `onExtractorError` event fires, and the call's cost is not recorded (the response is still returned to the caller). The extractor is called synchronously after the wrapped function resolves.

### Token-Based Cost Estimation

For callers who have access to token counts but not dollar amounts, the breaker supports a `pricing` configuration that converts tokens to dollars:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'daily', limit: 50 }],
  pricing: {
    inputCostPer1M: 2.50,   // $2.50 per 1M input tokens
    outputCostPer1M: 10.00,  // $10.00 per 1M output tokens
  },
});

// Record by token count instead of dollar amount
breaker.recordTokens({ inputTokens: 1500, outputTokens: 300 });
// Equivalent to: breaker.recordSpend(1500 * 2.50/1e6 + 300 * 10.00/1e6)
```

This is a convenience method. The breaker internally converts token counts to dollar amounts using the configured pricing and calls `recordSpend` with the result. For dynamic pricing (different models at different rates), the caller should compute the cost externally using `model-price-registry` and call `recordSpend` directly.

### Pre-Flight Cost Check

Before making an expensive call, the caller can check whether the estimated cost would exceed any budget:

```typescript
const estimate = 0.15; // estimated cost of the next call

if (breaker.wouldExceedBudget(estimate)) {
  // Skip the call or use a cheaper alternative
  console.log('Estimated cost would exceed budget, downgrading to cheaper model');
} else {
  const response = await wrappedCall(args);
  breaker.recordSpend(actualCost);
}
```

`wouldExceedBudget(estimatedCost)` returns `true` if adding `estimatedCost` to any window's current accumulator would exceed that window's threshold. It does not modify any state -- it is a pure read operation.

### Spend History

The breaker maintains a per-window spend history within the current window:

```typescript
const state = breaker.getState();
// state.windows[0].spent    -> 7.23 (dollars spent in current hourly window)
// state.windows[0].limit    -> 10.00 (hourly limit)
// state.windows[0].remaining -> 2.77 (dollars remaining)
// state.windows[0].resetsIn  -> 1234567 (milliseconds until window resets)
// state.windows[0].history   -> [{ cost: 0.05, timestamp: ... }, ...]
```

The `history` array contains individual `recordSpend` entries within the current window. When the window resets, the history is cleared. The history has a configurable maximum size (`maxHistorySize`, default: 1000) to prevent unbounded memory growth in high-throughput scenarios. When the maximum is reached, the oldest entries are dropped (the spend total is not affected -- only the per-entry history is truncated).

---

## 8. Fallback Strategies

### Throw (Default)

When the circuit is open, the wrapped function throws a `BudgetExceededError`:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: { strategy: 'throw' }, // This is the default
});

const wrapped = breaker.wrap(apiCall);

try {
  await wrapped(args);
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log(error.message);    // "Budget exceeded: hourly spend $10.23 exceeds limit $10.00"
    console.log(error.threshold);  // { window: 'hourly', limit: 10, spent: 10.23 }
    console.log(error.resetsIn);   // 1823000 (ms until window resets)
  }
}
```

`BudgetExceededError` extends `Error` and includes structured metadata about the breach: which threshold was exceeded, the current spend, the limit, and the time until the window resets.

### Cached Response

The breaker caches the last successful response from the wrapped function. When the circuit is open, it returns the cached response instead of calling the API:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: { strategy: 'cached' },
});
```

If no cached response exists (the circuit opens before the first successful call), the breaker falls back to throwing a `BudgetExceededError`. The cache stores a single entry (the most recent successful response). The cache is not shared across different argument sets -- any call when the circuit is open gets the same cached response, regardless of what arguments were passed.

### Downgrade to Cheaper Model

The caller provides a fallback function that is called when the circuit is open. This is typically used to call a cheaper model:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => {
      // Call a cheaper model instead
      return cheaperClient.chat({
        ...args,
        model: 'gpt-4o-mini', // 60x cheaper than gpt-4o
      });
    },
  },
});
```

The downgrade function receives the same arguments that would have been passed to the original function. Its return value is returned to the caller as if the original function had been called. Cost from the downgrade function is not automatically tracked by this breaker instance (the downgrade function can have its own breaker, or the caller can manually record its cost).

### Custom Fallback

A custom fallback function receives the original arguments and the breaker's current state, providing full flexibility:

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: {
    strategy: 'custom',
    fn: async (args, state) => {
      if (state.windows[0].remaining < 1) {
        // Very low budget -- return a static response
        return { message: 'Service at capacity. Please try again later.' };
      } else {
        // Some budget left -- try a cheaper model
        return cheaperClient.chat({ ...args, model: 'gpt-4o-mini' });
      }
    },
  },
});
```

---

## 9. API Surface

### Installation

```bash
npm install ai-circuit-breaker
```

### Primary Function: `createBreaker`

Creates a new spend-based circuit breaker instance.

```typescript
import { createBreaker } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },
    { window: 'daily', limit: 100 },
  ],
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => cheaperClient.chat({ ...args, model: 'gpt-4o-mini' }),
  },
});
```

### Wrapping a Function: `breaker.wrap`

Wraps an async function with spend-based circuit breaking.

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import OpenAI from 'openai';

const openai = new OpenAI();
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  costExtractor: (response) => {
    const u = response.usage;
    return u.prompt_tokens * (2.50 / 1e6) + u.completion_tokens * (10.00 / 1e6);
  },
});

const chat = breaker.wrap(
  (params: OpenAI.ChatCompletionCreateParams) => openai.chat.completions.create(params),
);

// Use exactly like the original function
const response = await chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
// Cost is automatically extracted and recorded
```

### Recording Spend: `breaker.recordSpend`

Manually records the cost of an API call.

```typescript
breaker.recordSpend(0.0045); // $0.0045
```

### Recording Tokens: `breaker.recordTokens`

Records cost based on token counts, using the breaker's configured pricing.

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'daily', limit: 50 }],
  pricing: { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
});

breaker.recordTokens({ inputTokens: 5000, outputTokens: 1200 });
```

### Querying State: `breaker.getState`

Returns the current state of the breaker.

```typescript
const state = breaker.getState();
console.log(state.state);            // 'closed' | 'open' | 'half-open'
console.log(state.totalSpent);       // 7.23 (total across all time, not reset by windows)
console.log(state.windows);          // per-window details
console.log(state.windows[0].spent); // 3.50 (spent in current hourly window)
console.log(state.windows[0].limit); // 10.00
console.log(state.windows[0].remaining); // 6.50
console.log(state.windows[0].resetsIn);  // 1823000 (ms)
```

### Pre-Flight Check: `breaker.wouldExceedBudget`

Checks whether an estimated cost would exceed any budget threshold without modifying state.

```typescript
if (breaker.wouldExceedBudget(0.50)) {
  console.log('Estimated cost would breach budget');
}
```

### Manual Reset: `breaker.reset`

Resets all spend accumulators to zero and transitions the circuit to closed.

```typescript
breaker.reset();
```

### Budget Replenishment: `breaker.addBudget`

Increases the limit for a specific window, allowing the circuit to close if it was open.

```typescript
breaker.addBudget('hourly', 5); // Add $5 to the hourly budget limit
```

### State Export and Import: `breaker.exportState` / `createBreaker({ initialState })`

For persistence across process restarts:

```typescript
// Before shutdown
const snapshot = breaker.exportState();
fs.writeFileSync('breaker-state.json', JSON.stringify(snapshot));

// On startup
const saved = JSON.parse(fs.readFileSync('breaker-state.json', 'utf-8'));
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  initialState: saved,
});
```

### Type Definitions

```typescript
// ── Budget Window Configuration ─────────────────────────────────────

/** Built-in window types. */
type WindowType = 'hourly' | 'daily' | 'monthly';

/** Custom window configuration. */
interface CustomWindow {
  type: 'custom';

  /** Duration in milliseconds. */
  durationMs: number;
}

/** A single budget threshold. */
interface BudgetThreshold {
  /** The time window for this budget. */
  window: WindowType | CustomWindow;

  /** Maximum spend (in dollars) allowed within this window. */
  limit: number;

  /** Percentage of limit at which to emit a warning event. Default: 0.8 (80%). */
  warningThreshold?: number;
}

// ── Fallback Configuration ──────────────────────────────────────────

/** Throw a BudgetExceededError. */
interface ThrowFallback {
  strategy: 'throw';
}

/** Return the last cached successful response. */
interface CachedFallback {
  strategy: 'cached';
}

/** Call a fallback function (typically a cheaper model). */
interface DowngradeFallback<TArgs = any, TResult = any> {
  strategy: 'downgrade';

  /** The fallback function to call when the circuit is open. */
  fn: (args: TArgs) => Promise<TResult>;
}

/** Call a custom fallback function with full state access. */
interface CustomFallback<TArgs = any, TResult = any> {
  strategy: 'custom';

  /** The custom fallback function. */
  fn: (args: TArgs, state: BreakerState) => Promise<TResult>;
}

type FallbackConfig<TArgs = any, TResult = any> =
  | ThrowFallback
  | CachedFallback
  | DowngradeFallback<TArgs, TResult>
  | CustomFallback<TArgs, TResult>;

// ── Pricing Configuration ───────────────────────────────────────────

/** Token-to-dollar pricing for recordTokens convenience method. */
interface PricingConfig {
  /** Cost in dollars per 1 million input tokens. */
  inputCostPer1M: number;

  /** Cost in dollars per 1 million output tokens. */
  outputCostPer1M: number;
}

// ── Breaker Configuration ───────────────────────────────────────────

/** Configuration for createBreaker. */
interface BreakerConfig<TArgs = any, TResult = any> {
  /** Budget thresholds. At least one is required. */
  budgets: BudgetThreshold[];

  /** Fallback strategy when the circuit is open. Default: { strategy: 'throw' }. */
  fallback?: FallbackConfig<TArgs, TResult>;

  /** Pricing configuration for recordTokens. Optional. */
  pricing?: PricingConfig;

  /**
   * Function to automatically extract cost from the wrapped function's return value.
   * If provided, recordSpend is called automatically after each successful call.
   */
  costExtractor?: (result: TResult) => number;

  /**
   * Number of probe calls allowed in half-open state.
   * Default: 1.
   */
  probeCount?: number;

  /**
   * Minimum time in milliseconds to stay in open state before transitioning to half-open,
   * even if a window resets or budget is replenished.
   * Prevents rapid open/close cycling.
   * Default: 5000 (5 seconds).
   */
  cooldownMs?: number;

  /**
   * Maximum number of spend history entries to retain per window.
   * Default: 1000.
   */
  maxHistorySize?: number;

  /**
   * Timezone for daily and monthly window alignment.
   * Default: 'UTC'.
   */
  timezone?: string;

  /**
   * Previously exported state to restore on creation.
   * Used for persistence across process restarts.
   */
  initialState?: ExportedBreakerState;

  /** Event hooks. */
  hooks?: BreakerHooks;
}

// ── Breaker State ───────────────────────────────────────────────────

/** Circuit breaker state. */
type CircuitState = 'closed' | 'open' | 'half-open';

/** Per-window state information. */
interface WindowState {
  /** The window type. */
  window: WindowType | CustomWindow;

  /** Spend accumulated in the current window period. */
  spent: number;

  /** The budget limit for this window. */
  limit: number;

  /** Remaining budget (limit - spent). Clamped to 0. */
  remaining: number;

  /** Milliseconds until this window resets. */
  resetsIn: number;

  /** ISO 8601 timestamp when the current window started. */
  windowStart: string;

  /** ISO 8601 timestamp when the current window ends. */
  windowEnd: string;

  /** Whether this window's threshold is currently breached. */
  breached: boolean;

  /** Individual spend entries in the current window (bounded by maxHistorySize). */
  history: SpendEntry[];
}

/** A single spend recording. */
interface SpendEntry {
  /** Dollar amount. */
  cost: number;

  /** ISO 8601 timestamp of when the spend was recorded. */
  timestamp: string;
}

/** Complete breaker state returned by getState(). */
interface BreakerState {
  /** Current circuit state. */
  state: CircuitState;

  /** Total spend across all time (not reset by window resets). */
  totalSpent: number;

  /** Per-window state details. */
  windows: WindowState[];

  /** Number of probe calls remaining (only meaningful in half-open state). */
  probesRemaining: number;

  /** The threshold that caused the circuit to open. Undefined if closed. */
  breachedThreshold?: {
    window: WindowType | CustomWindow;
    limit: number;
    spent: number;
  };
}

/** Serializable state for export/import. */
interface ExportedBreakerState {
  /** Per-window accumulators and window boundaries. */
  windows: Array<{
    window: WindowType | CustomWindow;
    spent: number;
    windowStart: string;
    windowEnd: string;
  }>;

  /** Total lifetime spend. */
  totalSpent: number;

  /** Circuit state at export time. */
  state: CircuitState;

  /** ISO 8601 timestamp of when the state was exported. */
  exportedAt: string;
}

// ── Budget Exceeded Error ───────────────────────────────────────────

/** Error thrown when the circuit is open and fallback strategy is 'throw'. */
declare class BudgetExceededError extends Error {
  /** The threshold that was breached. */
  readonly threshold: {
    window: WindowType | CustomWindow;
    limit: number;
    spent: number;
  };

  /** Milliseconds until the breached window resets. */
  readonly resetsIn: number;

  /** Current circuit state. */
  readonly circuitState: CircuitState;

  /** Human-readable message. */
  readonly message: string;
}

// ── Event Hooks ─────────────────────────────────────────────────────

/** Event hooks for observability. */
interface BreakerHooks {
  /** Called when the circuit transitions to open. */
  onOpen?: (info: {
    threshold: { window: WindowType | CustomWindow; limit: number; spent: number };
    totalSpent: number;
  }) => void;

  /** Called when the circuit transitions to closed. */
  onClose?: (info: {
    previousState: 'open' | 'half-open';
    totalSpent: number;
  }) => void;

  /** Called when the circuit transitions to half-open. */
  onHalfOpen?: (info: {
    reason: 'window-reset' | 'budget-replenished' | 'cooldown-expired';
    probeCount: number;
  }) => void;

  /** Called after every recordSpend call. */
  onSpendRecorded?: (info: {
    cost: number;
    totalSpent: number;
    windows: Array<{ window: WindowType | CustomWindow; spent: number; limit: number; remaining: number }>;
  }) => void;

  /** Called when spend reaches the warning threshold for any window. */
  onBudgetWarning?: (info: {
    window: WindowType | CustomWindow;
    spent: number;
    limit: number;
    warningThreshold: number;
    percentUsed: number;
  }) => void;

  /** Called when a budget window resets. */
  onWindowReset?: (info: {
    window: WindowType | CustomWindow;
    previousSpent: number;
  }) => void;

  /** Called when the costExtractor throws an error. */
  onExtractorError?: (info: {
    error: unknown;
    result: unknown;
  }) => void;
}

// ── Breaker Instance ────────────────────────────────────────────────

/** The circuit breaker instance returned by createBreaker. */
interface Breaker<TArgs = any, TResult = any> {
  /**
   * Wrap an async function with spend-based circuit breaking.
   * Returns a new function with the same signature.
   */
  wrap(fn: (args: TArgs) => Promise<TResult>): (args: TArgs) => Promise<TResult>;

  /**
   * Record the cost of a completed API call.
   * @param cost - Dollar amount (positive number).
   */
  recordSpend(cost: number): void;

  /**
   * Record cost based on token counts using configured pricing.
   * Requires pricing to be configured in createBreaker.
   */
  recordTokens(usage: { inputTokens: number; outputTokens: number }): void;

  /**
   * Get the current breaker state.
   */
  getState(): BreakerState;

  /**
   * Check whether an estimated cost would exceed any budget threshold.
   * Does not modify state.
   */
  wouldExceedBudget(estimatedCost: number): boolean;

  /**
   * Reset all spend accumulators to zero and transition to closed.
   */
  reset(): void;

  /**
   * Add budget to a specific window's limit.
   * If the circuit is open and this addition brings spend below the limit,
   * the circuit transitions to half-open.
   */
  addBudget(window: WindowType | CustomWindow, amount: number): void;

  /**
   * Export the current state for persistence.
   */
  exportState(): ExportedBreakerState;
}
```

### Function Signatures

```typescript
/**
 * Create a new spend-based circuit breaker.
 *
 * @param config - Breaker configuration with budget thresholds, fallback strategy, and hooks.
 * @returns A Breaker instance.
 */
function createBreaker<TArgs = any, TResult = any>(
  config: BreakerConfig<TArgs, TResult>,
): Breaker<TArgs, TResult>;
```

---

## 10. Events

### onOpen

Fires when the circuit transitions from closed to open.

```typescript
const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  hooks: {
    onOpen: ({ threshold, totalSpent }) => {
      console.error(
        `Circuit opened: ${threshold.window} spend $${threshold.spent.toFixed(2)} ` +
        `exceeds limit $${threshold.limit.toFixed(2)}. Total spent: $${totalSpent.toFixed(2)}`
      );
      // Alert the team, send a Slack notification, etc.
    },
  },
});
```

**When:** `recordSpend` causes cumulative spend to exceed any threshold while the circuit is closed.

**Payload:** `{ threshold: { window, limit, spent }, totalSpent }`.

### onClose

Fires when the circuit transitions from open or half-open to closed.

**When:** Probe calls in half-open state complete with all accumulators below their thresholds, or `reset()` is called manually.

**Payload:** `{ previousState: 'open' | 'half-open', totalSpent }`.

### onHalfOpen

Fires when the circuit transitions from open to half-open.

**When:** A budget window resets, budget is replenished via `addBudget`, or the `cooldownMs` timer expires.

**Payload:** `{ reason: 'window-reset' | 'budget-replenished' | 'cooldown-expired', probeCount }`.

### onSpendRecorded

Fires after every `recordSpend` call (including automatic recording via `costExtractor`).

**When:** Every time spend is recorded, regardless of circuit state.

**Payload:** `{ cost, totalSpent, windows: [{ window, spent, limit, remaining }] }`.

### onBudgetWarning

Fires when spend reaches the warning threshold (default 80%) for any window.

**When:** A `recordSpend` call causes a window's spend to cross the warning threshold. Fires at most once per window per window period (not repeatedly for every subsequent `recordSpend`).

**Payload:** `{ window, spent, limit, warningThreshold, percentUsed }`.

### onWindowReset

Fires when a budget window resets.

**When:** A lazy reset check detects that a window period has elapsed.

**Payload:** `{ window, previousSpent }`.

### onExtractorError

Fires when the `costExtractor` function throws or returns a non-number.

**When:** The `costExtractor` is configured and throws during automatic cost extraction.

**Payload:** `{ error, result }` where `result` is the wrapped function's return value that was passed to the extractor.

---

## 11. Configuration

### Default Values

| Option | Default | Description |
|---|---|---|
| `budgets` | (required) | At least one budget threshold is required. |
| `fallback.strategy` | `'throw'` | What to do when the circuit is open. |
| `pricing` | `undefined` | Token-to-dollar pricing. Required only if `recordTokens` is used. |
| `costExtractor` | `undefined` | Auto-extract cost from responses. |
| `probeCount` | `1` | Number of calls allowed in half-open state. |
| `cooldownMs` | `5000` | Minimum time in open state before transitioning to half-open. |
| `maxHistorySize` | `1000` | Maximum spend history entries per window. |
| `timezone` | `'UTC'` | Timezone for daily/monthly window alignment. |
| `warningThreshold` | `0.8` | Fraction of limit at which to emit budget warning (per-window). |

### Configuration Validation

All options are validated synchronously when `createBreaker` is called. Invalid values throw `TypeError` with actionable messages:

| Rule | Error |
|---|---|
| `budgets` must be a non-empty array | `TypeError: budgets must be a non-empty array of BudgetThreshold objects` |
| `limit` must be a positive number | `TypeError: limit must be a positive number, received -5` |
| `window` must be a valid WindowType or CustomWindow | `TypeError: window must be 'hourly', 'daily', 'monthly', or a CustomWindow object, received 'weekly'` |
| `CustomWindow.durationMs` must be a positive integer | `TypeError: durationMs must be a positive integer, received 0` |
| `probeCount` must be a positive integer | `TypeError: probeCount must be a positive integer, received 0` |
| `cooldownMs` must be a non-negative integer | `TypeError: cooldownMs must be a non-negative integer, received -1` |
| `warningThreshold` must be between 0 and 1 | `TypeError: warningThreshold must be between 0 and 1, received 1.5` |
| `maxHistorySize` must be a non-negative integer | `TypeError: maxHistorySize must be a non-negative integer` |
| `pricing.inputCostPer1M` must be a non-negative number | `TypeError: inputCostPer1M must be a non-negative number` |
| `pricing.outputCostPer1M` must be a non-negative number | `TypeError: outputCostPer1M must be a non-negative number` |
| `fallback.fn` must be a function (for `downgrade` and `custom`) | `TypeError: fallback.fn must be a function when strategy is 'downgrade'` |
| `recordTokens` called without `pricing` config | `Error: recordTokens requires pricing to be configured in createBreaker` |

---

## 12. Integration

### With model-price-registry

`model-price-registry` provides up-to-date pricing for LLM models across providers. Use it to compute accurate costs for `recordSpend`:

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import { getModelPrice } from 'model-price-registry';

const breaker = createBreaker({
  budgets: [{ window: 'daily', limit: 100 }],
});

const wrapped = breaker.wrap(apiClient.chat.bind(apiClient));

const response = await wrapped({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello' }],
});

const price = getModelPrice('claude-sonnet-4-20250514');
const cost = response.usage.input_tokens * (price.inputCostPer1M / 1e6)
           + response.usage.output_tokens * (price.outputCostPer1M / 1e6);
breaker.recordSpend(cost);
```

### With prompt-price

`prompt-price` estimates the cost of a prompt before sending it. Use it with `wouldExceedBudget` for pre-flight cost checking:

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import { estimateCost } from 'prompt-price';

const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
});

const messages = [{ role: 'user', content: longDocument }];
const estimate = estimateCost({ model: 'gpt-4o', messages });

if (breaker.wouldExceedBudget(estimate.totalCost)) {
  // Pre-flight check: this call would blow the budget
  const cheaperEstimate = estimateCost({ model: 'gpt-4o-mini', messages });
  if (!breaker.wouldExceedBudget(cheaperEstimate.totalCost)) {
    // Downgrade to cheaper model proactively
    response = await apiClient.chat({ model: 'gpt-4o-mini', messages });
    breaker.recordSpend(cheaperEstimate.totalCost);
  }
} else {
  response = await apiClient.chat({ model: 'gpt-4o', messages });
  breaker.recordSpend(estimate.totalCost);
}
```

### With token-fence

`token-fence` enforces per-request token budgets by truncating or summarizing context. It reduces the cost of individual calls, while `ai-circuit-breaker` controls aggregate spend. The two compose naturally:

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import { enforceFence } from 'token-fence';

const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
});

// token-fence reduces per-call cost
const fencedMessages = enforceFence(messages, { maxTokens: 4000, model: 'gpt-4o' });

// ai-circuit-breaker controls aggregate cost
const wrapped = breaker.wrap(apiClient.chat.bind(apiClient));
const response = await wrapped({ model: 'gpt-4o', messages: fencedMessages });
breaker.recordSpend(actualCost);
```

### With ai-chargeback

`ai-chargeback` tags AI costs by team, project, or feature. Use the `onSpendRecorded` hook to feed spend data into the chargeback system:

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import { recordCharge } from 'ai-chargeback';

const breaker = createBreaker({
  budgets: [{ window: 'monthly', limit: 5000 }],
  hooks: {
    onSpendRecorded: ({ cost }) => {
      recordCharge({
        amount: cost,
        team: 'ml-platform',
        project: 'customer-support-bot',
        model: 'gpt-4o',
      });
    },
  },
});
```

### With tool-call-retry

`tool-call-retry` provides error-based circuit breaking for tool functions. `ai-circuit-breaker` provides spend-based circuit breaking for AI API calls. They operate on different axes and compose together:

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import { withRetry } from 'tool-call-retry';

// Spend-based breaker for the AI API
const spendBreaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 10 }],
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => cheaperClient.chat({ ...args, model: 'gpt-4o-mini' }),
  },
});

// Error-based retry for the tool
const resilientSearch = withRetry(searchFunction, {
  maxRetries: 3,
  circuitBreaker: { failureThreshold: 5 },
});

// Compose: the AI call is spend-protected, the tool call is error-protected
const wrappedChat = spendBreaker.wrap(apiClient.chat.bind(apiClient));

async function agentLoop(query: string) {
  const response = await wrappedChat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: query }],
    tools: [{ type: 'function', function: { name: 'search', ... } }],
  });
  spendBreaker.recordSpend(computeCost(response));

  // Tool calls go through the error-based retry wrapper
  for (const toolCall of response.choices[0].message.tool_calls ?? []) {
    const result = await resilientSearch(toolCall.function.arguments);
    // ...
  }
}
```

### OpenAI SDK Integration

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import OpenAI from 'openai';

const openai = new OpenAI();

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 10 },
    { window: 'daily', limit: 100 },
  ],
  costExtractor: (response) => {
    const u = response.usage!;
    return u.prompt_tokens * (2.50 / 1e6) + u.completion_tokens * (10.00 / 1e6);
  },
  fallback: {
    strategy: 'downgrade',
    fn: async (params) => {
      // Downgrade to a cheaper model when budget is exceeded
      return openai.chat.completions.create({
        ...params,
        model: 'gpt-4o-mini',
      });
    },
  },
});

const chat = breaker.wrap(
  (params: OpenAI.ChatCompletionCreateParams) =>
    openai.chat.completions.create(params),
);

// Normal usage -- breaker handles spend tracking and circuit breaking
const response = await chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
});
```

### Anthropic SDK Integration

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const breaker = createBreaker({
  budgets: [{ window: 'hourly', limit: 20 }],
  costExtractor: (response) => {
    return response.usage.input_tokens * (3.00 / 1e6)
         + response.usage.output_tokens * (15.00 / 1e6);
  },
});

const chat = breaker.wrap(
  (params: Anthropic.MessageCreateParams) =>
    anthropic.messages.create(params),
);

const response = await chat({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

---

## 13. Testing Strategy

### Unit Tests

**Window calculation tests:** Verify hourly window boundaries: window starts at top of hour, ends at top of next hour, resets correctly. Verify daily window boundaries with UTC and non-UTC timezones. Verify monthly window boundaries (handle month-length variations: 28, 29, 30, 31 days). Verify custom window duration: starts at creation time, resets after durationMs. Verify lazy reset: window is not reset until the next interaction.

**Spend accumulation tests:** `recordSpend` adds cost to all active window accumulators. `recordSpend(0)` is a no-op. `recordSpend(-1)` throws `TypeError`. Spend is tracked independently per window. `totalSpent` never resets (even when windows reset). Spend history entries are added with correct timestamps. Spend history respects `maxHistorySize`: oldest entries are dropped.

**State transition tests:** Closed to open: triggered when spend exceeds any threshold. Open rejects all calls via the wrapped function. Open to half-open: triggered by window reset (lazy check). Open to half-open: triggered by `addBudget`. Half-open to closed: probe calls complete within budget. Half-open to open: probe costs push spend back over threshold. `reset()` transitions to closed from any state. `cooldownMs` prevents rapid cycling: circuit stays open for at least `cooldownMs` after opening. Multiple thresholds: circuit opens when any is breached, closes only when all are unbreached.

**Fallback strategy tests:** `throw` strategy: throws `BudgetExceededError` with correct metadata. `cached` strategy: returns last successful response. `cached` strategy: throws when no cache exists. `downgrade` strategy: calls the provided function with the original arguments. `custom` strategy: calls the provided function with arguments and state.

**Pre-flight check tests:** `wouldExceedBudget` returns `true` when estimated cost would breach any threshold. `wouldExceedBudget` returns `false` when cost fits within all budgets. `wouldExceedBudget` does not modify state. `wouldExceedBudget` checks against all windows.

**Cost extractor tests:** `costExtractor` is called with the wrapped function's return value. Extracted cost is passed to `recordSpend`. `costExtractor` that throws: error caught, `onExtractorError` fires, response still returned. `costExtractor` that returns NaN: treated as zero, warning emitted.

**Token recording tests:** `recordTokens` converts token counts to dollars using configured pricing. `recordTokens` without pricing config throws `Error`. Correct arithmetic: `inputTokens * inputCostPer1M / 1e6 + outputTokens * outputCostPer1M / 1e6`.

**Event hook tests:** `onOpen` fires on closed-to-open transition with correct payload. `onClose` fires on half-open-to-closed transition. `onHalfOpen` fires with correct `reason`. `onSpendRecorded` fires on every `recordSpend`. `onBudgetWarning` fires when crossing warning threshold. `onBudgetWarning` fires at most once per window period. `onWindowReset` fires on window reset with previous spend total. `onExtractorError` fires on extractor failure.

**Configuration validation tests:** Missing `budgets` throws. Empty `budgets` array throws. Negative `limit` throws. Invalid `window` type throws. Zero `durationMs` throws. Each invalid configuration produces the expected `TypeError` message.

**State export/import tests:** `exportState` produces a serializable object. Creating a breaker with `initialState` restores accumulators, state, and window boundaries. Expired windows in imported state are reset on first interaction. Total spend is restored accurately.

### Integration Tests

**End-to-end spend tracking:** Create a breaker with an hourly limit. Wrap a mock function. Call it repeatedly, recording spend each time. Verify the circuit opens when the limit is reached. Verify subsequent calls execute the fallback. Advance time past the window boundary. Verify the circuit transitions to half-open. Call the wrapped function (probe). Verify the circuit closes.

**Multiple budget windows:** Create a breaker with hourly and daily limits. Exhaust the hourly limit. Verify circuit opens. Advance past the hour. Verify circuit transitions to half-open and closes. Continue spending. Exhaust the daily limit. Verify circuit opens. Advance past the hour (but not the day). Verify circuit remains open (daily limit still breached).

**Downgrade fallback integration:** Create a breaker with a downgrade fallback that calls a mock "cheap" function. Exhaust the budget. Verify subsequent calls invoke the downgrade function, not the original.

**costExtractor integration:** Create a breaker with a `costExtractor`. Wrap a mock function that returns `{ usage: { prompt_tokens: 100, completion_tokens: 50 } }`. Call the wrapped function. Verify `recordSpend` was called automatically with the correct dollar amount.

### Edge Cases to Test

- Budget limit of zero: circuit opens immediately on any spend.
- Budget limit of `Infinity`: circuit never opens due to this threshold.
- Extremely small costs: `recordSpend(0.000001)` accumulates correctly across many calls.
- Rapid sequential calls: spend accumulates correctly without race conditions (synchronous accumulation).
- `recordSpend` called when circuit is open: spend is still tracked.
- Window reset with no spend: `onWindowReset` fires with `previousSpent: 0`.
- Multiple windows reset simultaneously: all are processed in a single lazy check.
- `addBudget` increases limit above current spend when circuit is open: triggers half-open transition.
- `addBudget` with amount that still leaves spend above limit: no state transition.
- `exportState` during open state: captures correct state.
- Import state with window boundaries in the past: windows are reset on first interaction.
- `wrap` called multiple times: each wrapped function shares the same breaker state.

### Test Framework

Tests use Vitest, matching the project's existing configuration. Time-dependent tests use Vitest's fake timers (`vi.useFakeTimers`, `vi.advanceTimersByTime`) to control window resets without real-time delays.

---

## 14. Performance

### Wrapper Overhead (Successful Call, Circuit Closed)

When the circuit is closed and a call passes through, the breaker adds:

1. **Lazy window reset check**: One `Date.now()` call and one comparison per window (~1-3 microseconds for 3 windows).
2. **State check**: One string comparison (`state === 'closed'`) (~1 microsecond).
3. **Try-catch around the wrapped function**: No overhead in the success path on modern V8.
4. **Cost extractor** (if configured): One synchronous function call (~1-5 microseconds depending on extractor complexity).
5. **recordSpend**: One addition per window, one comparison per window (~1-3 microseconds for 3 windows).

**Total overhead for a successful call with 3 budget windows**: approximately 5-15 microseconds. This is negligible compared to any LLM API call (hundreds of milliseconds to seconds).

### Open Circuit Path

When the circuit is open, the breaker:

1. **Lazy window reset check**: Same as above.
2. **State check**: One comparison, determines circuit is open.
3. **Fallback execution**: Depends on strategy. `throw` is ~1 microsecond. `cached` is ~1 microsecond (object return). `downgrade` depends on the fallback function.

**Total overhead for a rejected call**: approximately 3-10 microseconds (excluding fallback function execution time). This is the key benefit: expensive API calls are blocked in microseconds, not milliseconds.

### Memory

Per-breaker memory consumption:

- State fields (state, totalSpent, probes remaining, flags): ~100 bytes.
- Per-window accumulator: ~200 bytes per window (numbers, timestamps, references).
- Per-window history: bounded by `maxHistorySize`. Each entry is ~50 bytes (number + string). At default maximum of 1000 entries: ~50 KB per window.
- Cached response (if `cached` fallback): size of the last response object.

**Total per-breaker memory with 3 windows and default history size**: approximately 150-200 KB. For applications that do not need spend history, setting `maxHistorySize: 0` reduces per-window overhead to ~200 bytes.

### Timer Management

The breaker uses no background timers. All time-based logic (window resets, cooldown expiration, half-open transitions) is evaluated lazily when the next interaction occurs (`wrap`ped function call, `getState()`, or `recordSpend`). This means:

- No `setInterval` keeping the process alive.
- No CPU usage when the breaker is idle.
- No timer drift or accumulation issues in long-running processes.
- `process.exit()` is never blocked by breaker timers.

---

## 15. Dependencies

### Runtime Dependencies

None. `ai-circuit-breaker` has zero runtime dependencies. All functionality is implemented using built-in JavaScript APIs:

| API | Purpose |
|---|---|
| `Date.now()` | Window boundary calculation, timestamp generation |
| `Date` constructor | ISO 8601 timestamp formatting, window alignment |
| `Math.floor`, `Math.max`, `Math.min` | Window arithmetic, clamping |
| `Array` | Spend history, window accumulators |

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

### Why Zero Dependencies

The package performs three categories of operations: arithmetic (cost accumulation, window boundary calculation), state management (circuit state machine, per-window accumulators), and time logic (window alignment, reset detection). All three are trivially implementable with built-in JavaScript APIs. The total implementation is under 1000 lines of TypeScript. Adding a dependency for any of these would increase install size and introduce supply chain risk with no tangible benefit.

---

## 16. File Structure

```
ai-circuit-breaker/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  src/
    index.ts                          -- Public API exports: createBreaker, BudgetExceededError
    types.ts                          -- All TypeScript type definitions
    breaker.ts                        -- createBreaker factory and Breaker class implementation
    state-machine.ts                  -- Circuit state machine (closed/open/half-open transitions)
    window/
      index.ts                        -- Window factory: creates the appropriate window tracker
      hourly.ts                       -- Hourly window boundary calculation and reset logic
      daily.ts                        -- Daily window boundary calculation with timezone support
      monthly.ts                      -- Monthly window boundary calculation
      custom.ts                       -- Custom duration window
    spend-tracker.ts                  -- Per-window spend accumulation, history, and threshold checking
    fallback.ts                       -- Fallback strategy implementations (throw, cached, downgrade, custom)
    budget-exceeded-error.ts          -- BudgetExceededError class definition
    state-export.ts                   -- exportState/importState serialization logic
  src/__tests__/
    window/
      hourly.test.ts                  -- Hourly window boundary tests
      daily.test.ts                   -- Daily window boundary tests with timezone
      monthly.test.ts                 -- Monthly window boundary tests
      custom.test.ts                  -- Custom window duration tests
    spend-tracker.test.ts             -- Spend accumulation and threshold tests
    state-machine.test.ts             -- State transition tests
    fallback/
      throw.test.ts                   -- Throw strategy tests
      cached.test.ts                  -- Cached response tests
      downgrade.test.ts               -- Downgrade function tests
      custom.test.ts                  -- Custom fallback tests
    breaker.test.ts                   -- createBreaker factory tests, configuration validation
    events.test.ts                    -- Event hook emission tests
    pre-flight.test.ts                -- wouldExceedBudget tests
    cost-extractor.test.ts            -- Automatic cost extraction tests
    token-recording.test.ts           -- recordTokens tests
    state-export.test.ts              -- State export/import tests
    integration/
      openai.test.ts                  -- OpenAI SDK integration pattern
      anthropic.test.ts               -- Anthropic SDK integration pattern
      multi-window.test.ts            -- Multiple simultaneous budget windows
      end-to-end.test.ts              -- Full lifecycle: closed -> open -> half-open -> closed
    fixtures/
      mock-api.ts                     -- Mock API client that returns usage data
      mock-responses.ts               -- Mock API responses with token counts
  dist/                               -- Compiled output (generated by tsc)
```

---

## 17. Implementation Roadmap

### Phase 1: Core Breaker and Spend Tracking (v0.1.0)

Implement the foundation: the circuit state machine, spend tracking, and the `createBreaker` function with a single budget window type.

1. **Types**: Define all TypeScript types in `types.ts` -- `BreakerConfig`, `BreakerState`, `BudgetThreshold`, `WindowType`, `CircuitState`, `SpendEntry`, `BreakerHooks`, `FallbackConfig`.
2. **State machine**: Implement the closed/open/half-open state transitions in `state-machine.ts`. Transitions are driven by spend threshold breaches and window resets.
3. **Window: hourly**: Implement the hourly window boundary calculator in `window/hourly.ts`. Window alignment to clock boundaries, lazy reset detection.
4. **Spend tracker**: Implement per-window spend accumulation in `spend-tracker.ts`. Track cumulative spend, compare against threshold, emit events.
5. **Breaker factory**: Implement `createBreaker` and the `Breaker` class in `breaker.ts`. Wire together state machine, window, and spend tracker. Implement `wrap`, `recordSpend`, `getState`, `reset`.
6. **Fallback: throw**: Implement the default throw strategy and `BudgetExceededError`.
7. **Configuration validation**: Validate all config options at creation time.
8. **Tests**: State transition tests, spend accumulation tests, hourly window tests, throw fallback tests, validation tests.

### Phase 2: All Windows and Fallback Strategies (v0.2.0)

Add remaining window types and fallback strategies.

1. **Window: daily**: Implement daily window with timezone support.
2. **Window: monthly**: Implement monthly window with variable month lengths.
3. **Window: custom**: Implement custom-duration window.
4. **Multiple windows**: Support multiple simultaneous budget thresholds. Circuit opens on any breach, closes only when all are clear.
5. **Fallback: cached**: Implement cached response fallback with single-entry cache.
6. **Fallback: downgrade**: Implement downgrade function fallback.
7. **Fallback: custom**: Implement custom fallback with state access.
8. **Tests**: Multi-window interaction tests, each fallback strategy, daily/monthly boundary edge cases.

### Phase 3: Cost Extraction, Tokens, and Events (v0.3.0)

Add convenience features for cost tracking and observability.

1. **costExtractor**: Implement automatic cost extraction from wrapped function return values.
2. **recordTokens**: Implement token-to-dollar conversion using configured pricing.
3. **wouldExceedBudget**: Implement pre-flight cost checking.
4. **Event hooks**: Implement all event hooks (`onOpen`, `onClose`, `onHalfOpen`, `onSpendRecorded`, `onBudgetWarning`, `onWindowReset`, `onExtractorError`).
5. **Warning threshold**: Implement per-window warning threshold with once-per-period firing.
6. **addBudget**: Implement budget replenishment with half-open transition.
7. **Tests**: Extractor tests, token recording tests, pre-flight tests, event emission tests, warning threshold tests.

### Phase 4: Persistence and Production Readiness (v1.0.0)

Harden for production use.

1. **State export/import**: Implement `exportState` and `initialState` for persistence across restarts.
2. **Edge case hardening**: Test with extreme values (zero limit, Infinity limit, fractional-cent costs, rapid calls, concurrent access patterns).
3. **Spend history management**: Implement history size bounding with oldest-entry eviction.
4. **Performance profiling**: Benchmark wrapper overhead, verify sub-20-microsecond overhead for closed-circuit calls.
5. **Documentation**: Comprehensive README with installation, quick start, configuration reference, integration examples, and cost management best practices.

---

## 18. Example Use Cases

### 18.1 Protecting a Chatbot from Runaway Costs

A customer support chatbot uses GPT-4o for generating responses. During a marketing campaign, traffic spikes 10x. Without cost protection, the hourly API bill goes from $5 to $50. With `ai-circuit-breaker`, the chatbot degrades to a cheaper model when the hourly budget is hit.

```typescript
import { createBreaker } from 'ai-circuit-breaker';
import OpenAI from 'openai';

const openai = new OpenAI();

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 15 },
    { window: 'daily', limit: 200 },
  ],
  costExtractor: (response) => {
    const u = response.usage!;
    return u.prompt_tokens * (2.50 / 1e6) + u.completion_tokens * (10.00 / 1e6);
  },
  fallback: {
    strategy: 'downgrade',
    fn: async (params) => {
      // GPT-4o-mini is ~60x cheaper
      return openai.chat.completions.create({
        ...params,
        model: 'gpt-4o-mini',
      });
    },
  },
  hooks: {
    onOpen: ({ threshold }) => {
      alertOpsTeam(`AI budget exceeded: ${threshold.window} spend $${threshold.spent.toFixed(2)} > $${threshold.limit}`);
    },
    onBudgetWarning: ({ window, percentUsed }) => {
      console.warn(`Budget warning: ${window} at ${(percentUsed * 100).toFixed(0)}%`);
    },
  },
});

const chat = breaker.wrap(
  (params: OpenAI.ChatCompletionCreateParams) =>
    openai.chat.completions.create(params),
);

// In the request handler
app.post('/chat', async (req, res) => {
  const response = await chat({
    model: 'gpt-4o',
    messages: req.body.messages,
  });
  res.json(response);
  // Cost is auto-recorded via costExtractor
  // If budget exceeded, response came from gpt-4o-mini via fallback
});
```

### 18.2 Agent Loop with Hard Budget Ceiling

An autonomous agent makes multiple LLM calls per user query. The agent decides how many calls to make -- the human is not in the loop. A hard budget ceiling prevents the agent from spending more than $1 per query or $50 per hour.

```typescript
import { createBreaker, BudgetExceededError } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: { type: 'custom', durationMs: 60_000 }, limit: 1 },  // $1 per minute (per-query proxy)
    { window: 'hourly', limit: 50 },
  ],
  fallback: { strategy: 'throw' },
});

const chat = breaker.wrap(callLLM);

async function runAgent(query: string): Promise<string> {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query }];

  for (let i = 0; i < 20; i++) {
    try {
      const response = await chat({ model: 'gpt-4o', messages });
      breaker.recordSpend(computeCost(response));

      if (response.choices[0].finish_reason === 'stop') {
        return response.choices[0].message.content;
      }

      // Process tool calls, add to messages, continue loop
      messages.push(response.choices[0].message);
      // ... tool execution ...
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        return `I've reached my processing budget for this query. Here's what I found so far: ${summarizeProgress(messages)}`;
      }
      throw error;
    }
  }

  return 'Maximum iterations reached.';
}
```

### 18.3 Multi-Service Budget Allocation

A platform runs three AI-powered microservices sharing a single API key. Each service gets an independent breaker with a proportional budget allocation.

```typescript
import { createBreaker } from 'ai-circuit-breaker';

// Service A: 50% of budget
const serviceABreaker = createBreaker({
  budgets: [{ window: 'daily', limit: 250 }],  // $250/day out of $500 total
  hooks: {
    onOpen: () => alertOps('Service A budget exhausted'),
  },
});

// Service B: 30% of budget
const serviceBBreaker = createBreaker({
  budgets: [{ window: 'daily', limit: 150 }],  // $150/day
  hooks: {
    onOpen: () => alertOps('Service B budget exhausted'),
  },
});

// Service C: 20% of budget
const serviceCBreaker = createBreaker({
  budgets: [{ window: 'daily', limit: 100 }],  // $100/day
  fallback: {
    strategy: 'downgrade',
    fn: async (args) => callCheaperModel(args),
  },
});
```

### 18.4 Cost-Aware Development with State Persistence

A developer working on an AI feature wants to limit personal API spend during development. The breaker state persists across restarts so the daily budget tracks accurately.

```typescript
import { createBreaker, ExportedBreakerState } from 'ai-circuit-breaker';
import fs from 'node:fs';

const STATE_FILE = '.breaker-state.json';

function loadState(): ExportedBreakerState | undefined {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return undefined;
  }
}

const breaker = createBreaker({
  budgets: [{ window: 'daily', limit: 5 }],  // $5/day dev budget
  fallback: { strategy: 'throw' },
  initialState: loadState(),
  hooks: {
    onSpendRecorded: () => {
      fs.writeFileSync(STATE_FILE, JSON.stringify(breaker.exportState()));
    },
    onOpen: ({ threshold }) => {
      console.error(`\nDaily dev budget exhausted ($${threshold.spent.toFixed(2)}/$${threshold.limit}).`);
      console.error('Budget resets at midnight UTC. Use breaker.reset() to override.\n');
    },
  },
});
```

### 18.5 Monitoring Dashboard Integration

An observability system collects spend metrics from breakers across the fleet for a Grafana dashboard.

```typescript
import { createBreaker } from 'ai-circuit-breaker';

const breaker = createBreaker({
  budgets: [
    { window: 'hourly', limit: 100 },
    { window: 'daily', limit: 1000 },
  ],
  hooks: {
    onSpendRecorded: ({ cost, totalSpent, windows }) => {
      metrics.counter('ai.spend.total', cost);
      for (const w of windows) {
        metrics.gauge(`ai.budget.${w.window}.spent`, w.spent);
        metrics.gauge(`ai.budget.${w.window}.remaining`, w.remaining);
        metrics.gauge(`ai.budget.${w.window}.utilization`, w.spent / w.limit);
      }
    },
    onOpen: ({ threshold }) => {
      metrics.counter('ai.circuit_breaker.open', 1, { window: String(threshold.window) });
    },
    onClose: () => {
      metrics.counter('ai.circuit_breaker.close', 1);
    },
  },
});

// Periodic state reporting
setInterval(() => {
  const state = breaker.getState();
  metrics.gauge('ai.circuit_breaker.state', state.state === 'closed' ? 0 : state.state === 'open' ? 1 : 2);
}, 10_000);
```
