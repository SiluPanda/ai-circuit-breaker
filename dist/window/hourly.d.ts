import type { WindowTracker } from './types';
export declare class HourlyWindow implements WindowTracker {
    private windowStart;
    private windowEnd;
    constructor(now?: number);
    getWindowStart(): string;
    getWindowEnd(): string;
    isExpired(now?: number): boolean;
    reset(now?: number): void;
    getResetsIn(now?: number): number;
}
//# sourceMappingURL=hourly.d.ts.map