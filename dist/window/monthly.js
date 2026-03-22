"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonthlyWindow = void 0;
class MonthlyWindow {
    windowStart;
    windowEnd;
    constructor(now = Date.now()) {
        this.windowStart = MonthlyWindow.computeStart(now);
        this.windowEnd = MonthlyWindow.computeNextMonth(this.windowStart);
    }
    getWindowStart() {
        return new Date(this.windowStart).toISOString();
    }
    getWindowEnd() {
        return new Date(this.windowEnd).toISOString();
    }
    isExpired(now = Date.now()) {
        return now >= this.windowEnd;
    }
    reset(now = Date.now()) {
        this.windowStart = MonthlyWindow.computeStart(now);
        this.windowEnd = MonthlyWindow.computeNextMonth(this.windowStart);
    }
    getResetsIn(now = Date.now()) {
        return Math.max(0, this.windowEnd - now);
    }
    static computeStart(ts) {
        const d = new Date(ts);
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d.getTime();
    }
    static computeNextMonth(startTs) {
        const d = new Date(startTs);
        const month = d.getUTCMonth();
        const year = d.getUTCFullYear();
        if (month === 11) {
            d.setUTCFullYear(year + 1);
            d.setUTCMonth(0);
        }
        else {
            d.setUTCMonth(month + 1);
        }
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d.getTime();
    }
}
exports.MonthlyWindow = MonthlyWindow;
//# sourceMappingURL=monthly.js.map