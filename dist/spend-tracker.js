"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpendTracker = void 0;
class SpendTracker {
    limit;
    warningThreshold;
    maxHistorySize;
    spent = 0;
    breached = false;
    warningFired = false;
    history = [];
    constructor(limit, warningThreshold = 0.8, maxHistorySize = 1000) {
        this.limit = limit;
        this.warningThreshold = warningThreshold;
        this.maxHistorySize = maxHistorySize;
    }
    addSpend(cost) {
        if (cost < 0)
            throw new TypeError('cost must be non-negative');
        if (cost === 0)
            return { breached: this.breached, warningCrossed: false };
        this.spent += cost;
        this.history.push({ cost, timestamp: new Date().toISOString() });
        // Evict oldest if over max
        while (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        this.breached = this.spent >= this.limit;
        let warningCrossed = false;
        if (!this.warningFired && this.limit > 0 && (this.spent / this.limit) >= this.warningThreshold) {
            this.warningFired = true;
            warningCrossed = true;
        }
        return { breached: this.breached, warningCrossed };
    }
    getSpent() { return this.spent; }
    getLimit() { return this.limit; }
    setLimit(limit) {
        this.limit = limit;
        this.breached = this.spent >= this.limit;
    }
    getRemaining() { return Math.max(0, this.limit - this.spent); }
    isBreached() { return this.breached; }
    isWarningFired() { return this.warningFired; }
    getHistory() { return [...this.history]; }
    reset() {
        this.spent = 0;
        this.breached = false;
        this.warningFired = false;
        this.history = [];
    }
}
exports.SpendTracker = SpendTracker;
//# sourceMappingURL=spend-tracker.js.map