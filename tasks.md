# ai-circuit-breaker — Task Breakdown

Comprehensive task list derived from [SPEC.md](./SPEC.md). Each task is granular and actionable. Grouped by implementation phase matching the spec's roadmap.

---

## Phase 0: Project Scaffolding and Dev Dependencies

- [ ] **Install dev dependencies** — Install `typescript`, `vitest`, `eslint`, and `@types/node` as devDependencies. Verify `npm run build`, `npm run test`, and `npm run lint` scripts execute without errors on the empty project. | Status: not_done
- [ ] **Configure Vitest** — Create `vitest.config.ts` with support for fake timers, TypeScript path resolution, and the `src/__tests__` test directory. Ensure `npm run test` discovers and runs test files. | Status: not_done
- [ ] **Configure ESLint** — Set up ESLint config for TypeScript (strict mode). Ensure `npm run lint` runs against `src/`. | Status: not_done
- [ ] **Create directory structure** — Create all directories specified in the file structure: `src/window/`, `src/__tests__/`, `src/__tests__/window/`, `src/__tests__/fallback/`, `src/__tests__/integration/`, `src/__tests__/fixtures/`. | Status: not_done

---

## Phase 1: Core Types and Error Classes

- [ ] **Define WindowType type** — In `src/types.ts`, define `type WindowType = 'hourly' | 'daily' | 'monthly'`. | Status: not_done
- [ ] **Define CustomWindow interface** — In `src/types.ts`, define `CustomWindow` with `type: 'custom'` and `durationMs: number`. | Status: not_done
- [ ] **Define BudgetThreshold interface** — In `src/types.ts`, define `BudgetThreshold` with `window: WindowType | CustomWindow`, `limit: number`, and optional `warningThreshold?: number` (default 0.8). | Status: not_done
- [ ] **Define FallbackConfig types** — In `src/types.ts`, define `ThrowFallback`, `CachedFallback`, `DowngradeFallback<TArgs, TResult>`, `CustomFallback<TArgs, TResult>`, and the union type `FallbackConfig`. | Status: not_done
- [ ] **Define PricingConfig interface** — In `src/types.ts`, define `PricingConfig` with `inputCostPer1M: number` and `outputCostPer1M: number`. | Status: not_done
- [ ] **Define BreakerConfig interface** — In `src/types.ts`, define `BreakerConfig<TArgs, TResult>` with all fields: `budgets`, `fallback`, `pricing`, `costExtractor`, `probeCount`, `cooldownMs`, `maxHistorySize`, `timezone`, `initialState`, `hooks`. | Status: not_done
- [ ] **Define CircuitState type** — In `src/types.ts`, define `type CircuitState = 'closed' | 'open' | 'half-open'`. | Status: not_done
- [ ] **Define SpendEntry interface** — In `src/types.ts`, define `SpendEntry` with `cost: number` and `timestamp: string`. | Status: not_done
- [ ] **Define WindowState interface** — In `src/types.ts`, define `WindowState` with fields: `window`, `spent`, `limit`, `remaining`, `resetsIn`, `windowStart`, `windowEnd`, `breached`, `history`. | Status: not_done
- [ ] **Define BreakerState interface** — In `src/types.ts`, define `BreakerState` with `state`, `totalSpent`, `windows`, `probesRemaining`, and optional `breachedThreshold`. | Status: not_done
- [ ] **Define ExportedBreakerState interface** — In `src/types.ts`, define the serializable export format with `windows`, `totalSpent`, `state`, and `exportedAt`. | Status: not_done
- [ ] **Define BreakerHooks interface** — In `src/types.ts`, define all event hooks: `onOpen`, `onClose`, `onHalfOpen`, `onSpendRecorded`, `onBudgetWarning`, `onWindowReset`, `onExtractorError`. Each with its specific payload signature. | Status: not_done
- [ ] **Define Breaker interface** — In `src/types.ts`, define `Breaker<TArgs, TResult>` with methods: `wrap`, `recordSpend`, `recordTokens`, `getState`, `wouldExceedBudget`, `reset`, `addBudget`, `exportState`. | Status: not_done
- [ ] **Implement BudgetExceededError class** — In `src/budget-exceeded-error.ts`, create `BudgetExceededError extends Error` with readonly properties: `threshold` (window, limit, spent), `resetsIn`, `circuitState`, and a human-readable `message`. | Status: not_done
- [ ] **Write BudgetExceededError tests** — Test that the error extends `Error`, has the correct `name`, contains all metadata properties, and produces a readable message string. | Status: not_done

---

## Phase 2: Window Boundary Calculators

- [ ] **Define window tracker interface** — Define an internal interface for window trackers with methods: `getWindowStart()`, `getWindowEnd()`, `isExpired(now)`, `reset(now)`, and `getResetsIn(now)`. This is the contract all window types implement. | Status: not_done
- [ ] **Implement hourly window calculator** — In `src/window/hourly.ts`, implement window alignment to the top of the UTC hour. Given a timestamp, compute the current window's start (XX:00:00.000 UTC) and end (next XX:00:00.000 UTC). Support `alignTo` option for custom minute alignment. | Status: not_done
- [ ] **Implement lazy reset detection for hourly window** — The hourly window checks whether `Date.now()` has passed the window end. If so, it resets the window boundaries to the new current hour. No background timers. | Status: not_done
- [ ] **Write hourly window tests** — Test: window starts at top of hour, ends at top of next hour. Window created mid-hour has correct boundaries. Reset advances to next hour. `alignTo` shifts the window start minute. Edge case: window created at exactly XX:00:00.000. | Status: not_done
- [ ] **Implement daily window calculator** — In `src/window/daily.ts`, implement window alignment to midnight UTC by default. Support `timezone` option for non-UTC alignment. | Status: not_done
- [ ] **Write daily window tests** — Test: window starts at midnight UTC, ends at next midnight. Timezone option shifts alignment. Edge case: DST transitions (23-hour and 25-hour days if timezone is used). | Status: not_done
- [ ] **Implement monthly window calculator** — In `src/window/monthly.ts`, implement window alignment to the 1st of the month at midnight UTC. Handle variable month lengths (28, 29, 30, 31 days). Support `timezone` option. | Status: not_done
- [ ] **Write monthly window tests** — Test: window starts on 1st, ends on 1st of next month. February edge cases (28 vs 29 days). December to January transition. Timezone support. | Status: not_done
- [ ] **Implement custom duration window** — In `src/window/custom.ts`, implement a rolling window of configurable `durationMs`. Anchored to breaker creation time (or previous reset time). Not aligned to clock boundaries. | Status: not_done
- [ ] **Write custom window tests** — Test: window of 15 minutes starts at creation time. Reset advances by durationMs. Very short durations (1 second). Very long durations (1 week). | Status: not_done
- [ ] **Implement window factory** — In `src/window/index.ts`, create a factory function that takes a `WindowType | CustomWindow` and returns the appropriate window tracker instance. | Status: not_done
- [ ] **Write window factory tests** — Test: factory returns correct tracker for 'hourly', 'daily', 'monthly', and custom windows. Invalid window type throws. | Status: not_done

---

## Phase 3: Spend Tracker

- [ ] **Implement SpendTracker class** — In `src/spend-tracker.ts`, create a class that manages per-window spend accumulation. Holds a running total (`spent`), the threshold (`limit`), a `breached` flag, and a `warningFired` flag. | Status: not_done
- [ ] **Implement addSpend method** — `addSpend(cost)` adds the cost to the accumulator, checks against the threshold, and returns whether the threshold is now breached. | Status: not_done
- [ ] **Implement spend history tracking** — Each `addSpend` call adds a `SpendEntry` (cost + ISO timestamp) to the history array. Respect `maxHistorySize` by dropping the oldest entries when the limit is reached. | Status: not_done
- [ ] **Implement warning threshold detection** — When `addSpend` causes `spent / limit` to cross the `warningThreshold` (default 0.8), mark the warning as fired. The warning fires at most once per window period. | Status: not_done
- [ ] **Implement spend tracker reset** — Reset the accumulator to zero, clear history, reset the `warningFired` flag. Called when the associated window resets. | Status: not_done
- [ ] **Implement remaining budget calculation** — `remaining = Math.max(0, limit - spent)`. | Status: not_done
- [ ] **Write spend tracker tests** — Test: `addSpend` accumulates correctly. Threshold breach detection. Warning threshold fires once. History respects maxHistorySize with oldest-entry eviction. Reset clears everything. `addSpend(0)` is a no-op. Negative cost throws `TypeError`. | Status: not_done

---

## Phase 4: Circuit State Machine

- [ ] **Implement StateMachine class** — In `src/state-machine.ts`, implement the three-state circuit breaker pattern: closed, open, half-open. Track current state, the breached threshold, probe count remaining, and the timestamp when the circuit opened. | Status: not_done
- [ ] **Implement closed-to-open transition** — Triggered when `recordSpend` causes any window's spend to exceed its threshold. Store which threshold was breached. | Status: not_done
- [ ] **Implement open-to-half-open transition** — Triggered lazily when: (a) a window resets and the reset window was the breached one, (b) `addBudget` brings spend below the limit, or (c) `cooldownMs` has elapsed. The transition is checked on the next interaction (wrapped call or `getState()`). | Status: not_done
- [ ] **Implement half-open-to-closed transition** — Triggered when all probe calls complete and no window's spend exceeds its threshold. Reset the probe counter. | Status: not_done
- [ ] **Implement half-open-to-open transition** — Triggered when a probe call's recorded cost pushes any window's spend back over its threshold. | Status: not_done
- [ ] **Implement cooldownMs enforcement** — The circuit must remain in the open state for at least `cooldownMs` (default 5000ms) before transitioning to half-open, even if a window resets or budget is replenished. | Status: not_done
- [ ] **Implement probe counting in half-open state** — Track the number of probe calls allowed (`probeCount`, default 1). Decrement on each call that passes through. Calls beyond `probeCount` execute the fallback. | Status: not_done
- [ ] **Implement manual reset** — `reset()` transitions to closed from any state, resets all spend accumulators and window boundaries. | Status: not_done
- [ ] **Write state machine transition tests** — Test all transitions: closed->open, open->half-open (window reset), open->half-open (addBudget), open->half-open (cooldown expired), half-open->closed, half-open->open. Test that `reset()` works from all states. Test that `cooldownMs` prevents premature transition. | Status: not_done

---

## Phase 5: Fallback Strategies

- [ ] **Implement throw fallback** — In `src/fallback.ts`, implement the `throw` strategy: throw a `BudgetExceededError` with the breached threshold details, `resetsIn`, and circuit state. | Status: not_done
- [ ] **Implement cached fallback** — Implement the `cached` strategy: store the last successful response from the wrapped function. Return it when the circuit is open. If no cached response exists, fall back to throwing `BudgetExceededError`. | Status: not_done
- [ ] **Implement downgrade fallback** — Implement the `downgrade` strategy: call the user-provided `fn` with the same arguments that would have been passed to the original function. | Status: not_done
- [ ] **Implement custom fallback** — Implement the `custom` strategy: call the user-provided `fn` with the original arguments AND the current `BreakerState`. | Status: not_done
- [ ] **Write throw fallback tests** — Test that `BudgetExceededError` is thrown with correct metadata. | Status: not_done
- [ ] **Write cached fallback tests** — Test: returns cached response when available. Throws when no cache exists. Cache updates on each successful call. Cache is not argument-specific (same response for all args). | Status: not_done
- [ ] **Write downgrade fallback tests** — Test: fallback function is called with the original arguments. Return value is passed through to the caller. | Status: not_done
- [ ] **Write custom fallback tests** — Test: fallback function receives both arguments and breaker state. State reflects current window details. | Status: not_done

---

## Phase 6: Breaker Factory and Core API

- [ ] **Implement createBreaker factory** — In `src/breaker.ts`, implement the `createBreaker<TArgs, TResult>(config)` function. Wire together: config validation, window tracker creation (one per budget), spend tracker creation (one per budget), state machine, and fallback handler. Return a `Breaker` instance. | Status: not_done
- [ ] **Implement breaker.wrap method** — `wrap(fn)` returns a new async function with the same signature. On each call: (1) lazy window reset check, (2) check circuit state, (3) if closed or half-open with probes remaining: execute the original function; if open or half-open with no probes: execute fallback. (4) If `costExtractor` is configured, extract cost and call `recordSpend`. (5) If `cached` strategy, cache the successful response. | Status: not_done
- [ ] **Implement breaker.recordSpend method** — Add cost to all active window accumulators. Check thresholds. Trigger state transitions if any threshold is breached. Fire `onSpendRecorded` hook. Fire `onBudgetWarning` hook if warning threshold is crossed. Validate: cost must be a non-negative number; negative throws `TypeError`; zero is a no-op. | Status: not_done
- [ ] **Implement breaker.getState method** — Return a `BreakerState` object. Perform lazy window reset check before computing state. Include per-window details: spent, limit, remaining, resetsIn, windowStart, windowEnd, breached, history. | Status: not_done
- [ ] **Implement breaker.reset method** — Reset all spend accumulators to zero, reset all window boundaries to the current time, transition circuit to closed, fire `onClose` hook. | Status: not_done
- [ ] **Implement lazy window reset logic** — On every interaction (wrap call, getState, recordSpend), check if any window has expired. If so: reset that window's accumulator, fire `onWindowReset`, and potentially transition from open to half-open if the reset window was the breached one. | Status: not_done
- [ ] **Implement configuration validation** — Validate all config options synchronously in `createBreaker`. Throw `TypeError` with actionable messages for: empty budgets array, negative/zero limit, invalid window type, zero/negative durationMs, invalid probeCount, invalid cooldownMs, invalid warningThreshold (must be 0-1), invalid maxHistorySize, invalid pricing values, missing fn for downgrade/custom fallback. | Status: not_done
- [ ] **Set up public API exports in index.ts** — Export `createBreaker`, `BudgetExceededError`, and all public TypeScript types from `src/index.ts`. | Status: not_done
- [ ] **Write createBreaker factory tests** — Test: creates a breaker with valid config. Returns an object with all expected methods. Default values are applied (fallback: throw, probeCount: 1, cooldownMs: 5000, maxHistorySize: 1000, timezone: UTC, warningThreshold: 0.8). | Status: not_done
- [ ] **Write configuration validation tests** — Test each validation rule from the spec: missing budgets, empty budgets array, negative limit, invalid window type string, zero durationMs, zero probeCount, negative cooldownMs, warningThreshold > 1, negative pricing values, missing fn for downgrade/custom strategies. Verify exact error messages. | Status: not_done
- [ ] **Write wrap method tests** — Test: wrapped function executes when circuit is closed. Wrapped function is blocked when circuit is open. Return value passes through from original function. Arguments pass through correctly. Multiple wraps share the same breaker state. | Status: not_done
- [ ] **Write recordSpend tests** — Test: spend accumulates across calls. Threshold breach triggers open state. Zero cost is a no-op. Negative cost throws TypeError. Spend is added to all window accumulators simultaneously. `totalSpent` never resets even when windows reset. | Status: not_done

---

## Phase 7: Multiple Simultaneous Windows

- [ ] **Support multiple budget thresholds** — `createBreaker` accepts an array of budgets. Each budget gets its own window tracker and spend tracker. `recordSpend` adds cost to all trackers. Circuit opens when ANY threshold is breached. Circuit closes only when ALL thresholds are unbreached. | Status: not_done
- [ ] **Handle independent window resets** — When one window resets but another is still breached, the circuit remains open. Only transition to half-open if the reset window was the one that caused the opening AND no other window is breached. | Status: not_done
- [ ] **Handle multiple simultaneous window resets** — If multiple windows expire before the next interaction, all are reset in a single lazy check. | Status: not_done
- [ ] **Write multi-window tests** — Test: hourly + daily budgets. Exhaust hourly, circuit opens. Hour resets, circuit goes half-open and closes. Exhaust daily, circuit opens. Hour resets but daily still breached, circuit stays open. Both reset, circuit transitions. | Status: not_done

---

## Phase 8: Cost Extraction and Token Recording

- [ ] **Implement automatic cost extraction** — When `costExtractor` is provided in config, after each successful wrapped call, pass the return value through the extractor and call `recordSpend` with the result. If the extractor throws, catch the error, fire `onExtractorError`, and return the response to the caller without recording cost. If the extractor returns `NaN`, treat as zero and emit a warning. | Status: not_done
- [ ] **Implement breaker.recordTokens method** — Convert token counts to dollars using configured `pricing`: `inputTokens * inputCostPer1M / 1e6 + outputTokens * outputCostPer1M / 1e6`. Call `recordSpend` with the result. Throw `Error` if `pricing` is not configured. | Status: not_done
- [ ] **Write cost extractor tests** — Test: extractor is called with the wrapped function's return value. Extracted cost is recorded. Extractor that throws: error caught, `onExtractorError` fires, response still returned. Extractor that returns NaN: treated as zero. | Status: not_done
- [ ] **Write recordTokens tests** — Test: correct arithmetic conversion. Throws if pricing not configured. Works with zero tokens. Works with large token counts. | Status: not_done

---

## Phase 9: Pre-Flight Cost Check

- [ ] **Implement breaker.wouldExceedBudget method** — Check if adding `estimatedCost` to any window's current accumulator would exceed that window's threshold. Return `true` if any would be exceeded, `false` otherwise. Must not modify any state (pure read). Must perform lazy window reset check first (to avoid stale data). | Status: not_done
- [ ] **Write wouldExceedBudget tests** — Test: returns true when estimated cost would breach any threshold. Returns false when cost fits within all budgets. Does not modify state (call getState before and after, verify identical). Checks against all windows. Edge: estimated cost of 0 returns false. Edge: when circuit is already open, still checks against accumulators. | Status: not_done

---

## Phase 10: Budget Replenishment

- [ ] **Implement breaker.addBudget method** — Increase the `limit` for a specific window. If the circuit is open and the new limit brings spend below the threshold for all windows, and `cooldownMs` has elapsed, transition to half-open. Validate: `amount` must be a positive number. `window` must match one of the configured budgets. | Status: not_done
- [ ] **Write addBudget tests** — Test: increases the limit. Triggers half-open when spend is now below the new limit. Does not trigger transition if other windows are still breached. Does not trigger transition if cooldownMs has not elapsed. Throws on negative amount. Throws on unrecognized window. | Status: not_done

---

## Phase 11: Event Hooks

- [ ] **Implement onOpen hook** — Fire when the circuit transitions from closed to open. Payload: `{ threshold: { window, limit, spent }, totalSpent }`. | Status: not_done
- [ ] **Implement onClose hook** — Fire when the circuit transitions from open or half-open to closed. Payload: `{ previousState, totalSpent }`. Also fires on manual `reset()`. | Status: not_done
- [ ] **Implement onHalfOpen hook** — Fire when the circuit transitions from open to half-open. Payload: `{ reason: 'window-reset' | 'budget-replenished' | 'cooldown-expired', probeCount }`. | Status: not_done
- [ ] **Implement onSpendRecorded hook** — Fire after every `recordSpend` call (including automatic recording via costExtractor). Payload: `{ cost, totalSpent, windows: [{ window, spent, limit, remaining }] }`. | Status: not_done
- [ ] **Implement onBudgetWarning hook** — Fire when spend crosses the warning threshold (default 80%) for any window. Fire at most once per window per window period. Payload: `{ window, spent, limit, warningThreshold, percentUsed }`. | Status: not_done
- [ ] **Implement onWindowReset hook** — Fire when a budget window resets (detected lazily). Payload: `{ window, previousSpent }`. | Status: not_done
- [ ] **Implement onExtractorError hook** — Fire when the `costExtractor` throws or returns a non-number. Payload: `{ error, result }`. | Status: not_done
- [ ] **Write event hook tests** — Test each hook fires at the correct time with the correct payload. Test `onBudgetWarning` fires at most once per window period. Test hooks are optional (no error if not provided). Test hooks that throw do not break breaker operation. | Status: not_done

---

## Phase 12: State Export and Import

- [ ] **Implement breaker.exportState method** — In `src/state-export.ts`, serialize the current breaker state into an `ExportedBreakerState` object: per-window accumulators and boundaries, totalSpent, circuit state, and an `exportedAt` ISO timestamp. The result must be JSON-serializable. | Status: not_done
- [ ] **Implement initialState restoration** — In `createBreaker`, accept `initialState: ExportedBreakerState`. Restore window accumulators, totalSpent, and circuit state from the imported data. If any imported window boundaries are in the past, reset those windows on first interaction (lazy). | Status: not_done
- [ ] **Write state export tests** — Test: `exportState` produces a JSON-serializable object. All fields are present. Exported during open state captures correct state. | Status: not_done
- [ ] **Write state import tests** — Test: creating a breaker with `initialState` restores accumulators and state. Expired windows in imported state are reset on first interaction. Total spend is restored accurately. Circuit state is restored. | Status: not_done

---

## Phase 13: Integration Tests

- [ ] **Write end-to-end lifecycle test** — Full cycle: create breaker, wrap a mock function, make calls in closed state, exhaust budget, verify open state with fallback, advance time past window reset, verify half-open transition, make probe call, verify closed transition. Use Vitest fake timers. | Status: not_done
- [ ] **Write multi-window integration test** — Create a breaker with hourly ($10) and daily ($100) limits. Exhaust hourly, verify open. Advance past hour, verify half-open and close. Continue spending to exhaust daily. Advance past hour but not day, verify circuit stays open. | Status: not_done
- [ ] **Write downgrade fallback integration test** — Create a breaker with a downgrade fallback that calls a mock "cheap" function. Exhaust the budget. Verify subsequent calls invoke the downgrade function, not the original. Verify arguments pass through. | Status: not_done
- [ ] **Write costExtractor integration test** — Create a breaker with a `costExtractor`. Wrap a mock function returning `{ usage: { prompt_tokens, completion_tokens } }`. Call the wrapped function. Verify `recordSpend` was called automatically with the correct dollar amount computed from token counts. | Status: not_done
- [ ] **Write OpenAI SDK integration pattern test** — Test the OpenAI integration pattern from the spec: wrap an OpenAI-like mock, use costExtractor to compute cost from usage, verify spend tracking and circuit breaking work together. | Status: not_done
- [ ] **Write Anthropic SDK integration pattern test** — Test the Anthropic integration pattern from the spec: wrap an Anthropic-like mock, use costExtractor for Anthropic's usage format. | Status: not_done
- [ ] **Create mock API client fixture** — In `src/__tests__/fixtures/mock-api.ts`, create a configurable mock API client that returns responses with `usage` fields (prompt_tokens, completion_tokens). Support configurable token counts per call. | Status: not_done
- [ ] **Create mock response fixtures** — In `src/__tests__/fixtures/mock-responses.ts`, create mock API responses with realistic token counts for various models (GPT-4o, GPT-4o-mini, Claude Sonnet, Claude Opus). | Status: not_done

---

## Phase 14: Edge Cases

- [ ] **Test budget limit of zero** — Circuit opens immediately on any spend. `wouldExceedBudget(any positive number)` returns true. | Status: not_done
- [ ] **Test budget limit of Infinity** — Circuit never opens due to this threshold. Spend accumulates but never breaches. | Status: not_done
- [ ] **Test extremely small costs** — `recordSpend(0.000001)` accumulates correctly across thousands of calls. Verify no floating-point drift causes premature/missed threshold breach. | Status: not_done
- [ ] **Test rapid sequential calls** — Spend accumulates correctly without race conditions (synchronous accumulation ensures this). | Status: not_done
- [ ] **Test recordSpend when circuit is open** — Spend is still tracked (the method is callable for manual recording even when circuit is open). | Status: not_done
- [ ] **Test window reset with no spend** — `onWindowReset` fires with `previousSpent: 0`. | Status: not_done
- [ ] **Test multiple windows reset simultaneously** — All are processed in a single lazy check. Multiple `onWindowReset` events fire. | Status: not_done
- [ ] **Test addBudget with amount that still leaves spend above limit** — No state transition occurs. | Status: not_done
- [ ] **Test wrap called multiple times** — Each wrapped function shares the same breaker state. Spend recorded through any wrapped function affects all. | Status: not_done
- [ ] **Test import state with window boundaries in the past** — Windows are reset on first interaction after import. | Status: not_done

---

## Phase 15: Performance Verification

- [ ] **Benchmark wrapper overhead (closed circuit)** — Measure overhead of a wrapped call when the circuit is closed with 3 budget windows. Verify sub-20-microsecond overhead. | Status: not_done
- [ ] **Benchmark open circuit rejection** — Measure overhead of rejecting a call when the circuit is open. Verify sub-10-microsecond overhead (excluding fallback execution). | Status: not_done
- [ ] **Verify no background timers** — Confirm the breaker does not create any `setInterval` or `setTimeout` calls. Verify the Node.js process can exit cleanly without `unref()` hacks. | Status: not_done
- [ ] **Verify memory bounds with maxHistorySize** — Create a breaker with `maxHistorySize: 100`. Record 500 spends. Verify history length is capped at 100 and oldest entries are evicted. | Status: not_done
- [ ] **Test maxHistorySize of zero** — Verify history array is always empty when `maxHistorySize: 0`. Spend tracking still works correctly. | Status: not_done

---

## Phase 16: Documentation

- [ ] **Write README.md** — Comprehensive README with: package description, installation, quick start example, full configuration reference, API reference for all methods, explanation of circuit states, budget window types, fallback strategies, integration examples (OpenAI, Anthropic, model-price-registry, prompt-price, token-fence, ai-chargeback, tool-call-retry), state persistence example, cost management best practices. | Status: not_done
- [ ] **Add JSDoc comments to all public types** — Every exported type, interface, and function in `src/types.ts` and `src/index.ts` must have JSDoc comments describing purpose, parameters, return values, and examples. | Status: not_done
- [ ] **Add JSDoc comments to all public methods** — Every method on the `Breaker` interface and the `createBreaker` function must have JSDoc comments. | Status: not_done
- [ ] **Add inline code comments for complex logic** — Window boundary calculation, lazy reset detection, state transition logic, and spend accumulation should have explanatory inline comments. | Status: not_done

---

## Phase 17: Build and Publish Preparation

- [ ] **Verify TypeScript compilation** — Run `npm run build` and verify `dist/` output contains `.js`, `.d.ts`, and `.d.ts.map` files for all source files. No compilation errors. | Status: not_done
- [ ] **Verify declaration files export correct types** — Verify that `dist/index.d.ts` exports `createBreaker`, `BudgetExceededError`, and all public types. Consumers should get full type information. | Status: not_done
- [ ] **Verify package.json fields** — Confirm `main` points to `dist/index.js`, `types` points to `dist/index.d.ts`, `files` includes `dist`, `engines.node` is `>=18`, `license` is `MIT`. | Status: not_done
- [ ] **Bump version to target release** — Update `package.json` version according to the implementation phase completed (0.1.0 for Phase 1 core, up to 1.0.0 for full implementation). | Status: not_done
- [ ] **Run full test suite and lint** — Execute `npm run test` and `npm run lint`. All tests pass, no lint errors. | Status: not_done
- [ ] **Verify zero runtime dependencies** — Confirm `package.json` has no `dependencies` field (only `devDependencies`). The built output must not require any external packages. | Status: not_done
