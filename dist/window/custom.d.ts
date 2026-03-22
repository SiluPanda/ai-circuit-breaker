import type { WindowTracker } from './types';
export declare class CustomDurationWindow implements WindowTracker {
    private readonly durationMs;
    private windowStart;
    private windowEnd;
    constructor(durationMs: number, now?: number);
    getWindowStart(): string;
    getWindowEnd(): string;
    isExpired(now?: number): boolean;
    reset(now?: number): void;
    getResetsIn(now?: number): number;
}
//# sourceMappingURL=custom.d.ts.map