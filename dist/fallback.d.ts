import type { FallbackConfig, BreakerState, CircuitState, WindowType, CustomWindow } from './types';
export interface FallbackContext {
    threshold: {
        window: WindowType | CustomWindow;
        limit: number;
        spent: number;
    };
    resetsIn: number;
    circuitState: CircuitState;
    state: BreakerState;
}
export declare class FallbackHandler<TArgs = unknown, TResult = unknown> {
    private readonly config;
    private cachedResponse;
    private hasCachedResponse;
    constructor(config: FallbackConfig<TArgs, TResult>);
    /** Cache the latest successful response (for 'cached' strategy). */
    cacheResponse(response: TResult): void;
    /** Execute the fallback strategy. */
    execute(args: TArgs, context: FallbackContext): Promise<TResult>;
}
//# sourceMappingURL=fallback.d.ts.map