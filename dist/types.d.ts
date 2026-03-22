export type WindowType = 'hourly' | 'daily' | 'monthly';
export interface CustomWindow {
    type: 'custom';
    durationMs: number;
}
export interface BudgetThreshold {
    window: WindowType | CustomWindow;
    limit: number;
    warningThreshold?: number;
}
export interface ThrowFallback {
    strategy: 'throw';
}
export interface CachedFallback {
    strategy: 'cached';
}
export interface DowngradeFallback<TArgs = unknown, TResult = unknown> {
    strategy: 'downgrade';
    fn: (args: TArgs) => Promise<TResult>;
}
export interface CustomFallback<TArgs = unknown, TResult = unknown> {
    strategy: 'custom';
    fn: (args: TArgs, state: BreakerState) => Promise<TResult>;
}
export type FallbackConfig<TArgs = unknown, TResult = unknown> = ThrowFallback | CachedFallback | DowngradeFallback<TArgs, TResult> | CustomFallback<TArgs, TResult>;
export interface PricingConfig {
    inputCostPer1M: number;
    outputCostPer1M: number;
}
export interface BreakerConfig<TArgs = unknown, TResult = unknown> {
    budgets: BudgetThreshold[];
    fallback?: FallbackConfig<TArgs, TResult>;
    pricing?: PricingConfig;
    costExtractor?: (result: TResult) => number;
    probeCount?: number;
    cooldownMs?: number;
    maxHistorySize?: number;
    timezone?: string;
    initialState?: ExportedBreakerState;
    hooks?: BreakerHooks;
}
export type CircuitState = 'closed' | 'open' | 'half-open';
export interface SpendEntry {
    cost: number;
    timestamp: string;
}
export interface WindowState {
    window: WindowType | CustomWindow;
    spent: number;
    limit: number;
    remaining: number;
    resetsIn: number;
    windowStart: string;
    windowEnd: string;
    breached: boolean;
    history: SpendEntry[];
}
export interface BreakerState {
    state: CircuitState;
    totalSpent: number;
    windows: WindowState[];
    probesRemaining: number;
    breachedThreshold?: {
        window: WindowType | CustomWindow;
        limit: number;
        spent: number;
    };
}
export interface ExportedBreakerState {
    windows: Array<{
        window: WindowType | CustomWindow;
        spent: number;
        windowStart: string;
        windowEnd: string;
    }>;
    totalSpent: number;
    state: CircuitState;
    exportedAt: string;
}
export interface BreakerHooks {
    onOpen?: (info: {
        threshold: {
            window: WindowType | CustomWindow;
            limit: number;
            spent: number;
        };
        totalSpent: number;
    }) => void;
    onClose?: (info: {
        previousState: 'open' | 'half-open';
        totalSpent: number;
    }) => void;
    onHalfOpen?: (info: {
        reason: 'window-reset' | 'budget-replenished' | 'cooldown-expired';
        probeCount: number;
    }) => void;
    onSpendRecorded?: (info: {
        cost: number;
        totalSpent: number;
        windows: Array<{
            window: WindowType | CustomWindow;
            spent: number;
            limit: number;
            remaining: number;
        }>;
    }) => void;
    onBudgetWarning?: (info: {
        window: WindowType | CustomWindow;
        spent: number;
        limit: number;
        warningThreshold: number;
        percentUsed: number;
    }) => void;
    onWindowReset?: (info: {
        window: WindowType | CustomWindow;
        previousSpent: number;
    }) => void;
    onExtractorError?: (info: {
        error: unknown;
        result: unknown;
    }) => void;
}
export interface Breaker<TArgs = unknown, TResult = unknown> {
    wrap(fn: (args: TArgs) => Promise<TResult>): (args: TArgs) => Promise<TResult>;
    recordSpend(cost: number): void;
    recordTokens(usage: {
        inputTokens: number;
        outputTokens: number;
    }): void;
    getState(): BreakerState;
    wouldExceedBudget(estimatedCost: number): boolean;
    reset(): void;
    addBudget(window: WindowType | CustomWindow, amount: number): void;
    exportState(): ExportedBreakerState;
}
//# sourceMappingURL=types.d.ts.map