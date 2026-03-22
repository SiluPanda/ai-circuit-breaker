"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyWindow = void 0;
class DailyWindow {
    windowStart;
    windowEnd;
    constructor(now = Date.now()) {
        const d = new Date(now);
        d.setUTCHours(0, 0, 0, 0);
        this.windowStart = d.getTime();
        this.windowEnd = this.windowStart + 86_400_000;
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
        const d = new Date(now);
        d.setUTCHours(0, 0, 0, 0);
        this.windowStart = d.getTime();
        this.windowEnd = this.windowStart + 86_400_000;
    }
    getResetsIn(now = Date.now()) {
        return Math.max(0, this.windowEnd - now);
    }
}
exports.DailyWindow = DailyWindow;
//# sourceMappingURL=daily.js.map