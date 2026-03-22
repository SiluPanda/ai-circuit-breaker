export interface WindowTracker {
    getWindowStart(): string;
    getWindowEnd(): string;
    isExpired(now?: number): boolean;
    reset(now?: number): void;
    getResetsIn(now?: number): number;
}
//# sourceMappingURL=types.d.ts.map