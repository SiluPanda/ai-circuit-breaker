"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDurationWindow = void 0;
class CustomDurationWindow {
    durationMs;
    windowStart;
    windowEnd;
    constructor(durationMs, now = Date.now()) {
        this.durationMs = durationMs;
        this.windowStart = now;
        this.windowEnd = this.windowStart + this.durationMs;
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
        this.windowStart = now;
        this.windowEnd = this.windowStart + this.durationMs;
    }
    getResetsIn(now = Date.now()) {
        return Math.max(0, this.windowEnd - now);
    }
}
exports.CustomDurationWindow = CustomDurationWindow;
//# sourceMappingURL=custom.js.map