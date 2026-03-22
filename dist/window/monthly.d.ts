import type { WindowTracker } from './types';
export declare class MonthlyWindow implements WindowTracker {
    private windowStart;
    private windowEnd;
    constructor(now?: number);
    getWindowStart(): string;
    getWindowEnd(): string;
    isExpired(now?: number): boolean;
    reset(now?: number): void;
    getResetsIn(now?: number): number;
    private static computeStart;
    private static computeNextMonth;
}
//# sourceMappingURL=monthly.d.ts.map