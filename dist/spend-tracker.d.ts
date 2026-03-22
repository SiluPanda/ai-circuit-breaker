import type { SpendEntry } from './types';
export declare class SpendTracker {
    private limit;
    private readonly warningThreshold;
    private readonly maxHistorySize;
    private spent;
    private breached;
    private warningFired;
    private history;
    constructor(limit: number, warningThreshold?: number, maxHistorySize?: number);
    addSpend(cost: number): {
        breached: boolean;
        warningCrossed: boolean;
    };
    getSpent(): number;
    getLimit(): number;
    setLimit(limit: number): void;
    getRemaining(): number;
    isBreached(): boolean;
    isWarningFired(): boolean;
    getHistory(): SpendEntry[];
    reset(): void;
}
//# sourceMappingURL=spend-tracker.d.ts.map