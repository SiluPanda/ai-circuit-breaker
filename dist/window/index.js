"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDurationWindow = exports.MonthlyWindow = exports.DailyWindow = exports.HourlyWindow = void 0;
exports.createWindowTracker = createWindowTracker;
const hourly_1 = require("./hourly");
const daily_1 = require("./daily");
const monthly_1 = require("./monthly");
const custom_1 = require("./custom");
function createWindowTracker(window, now) {
    switch (typeof window === 'string' ? window : window.type) {
        case 'hourly': return new hourly_1.HourlyWindow(now);
        case 'daily': return new daily_1.DailyWindow(now);
        case 'monthly': return new monthly_1.MonthlyWindow(now);
        case 'custom': return new custom_1.CustomDurationWindow(window.durationMs, now);
        default: throw new TypeError(`Invalid window type: ${window}`);
    }
}
var hourly_2 = require("./hourly");
Object.defineProperty(exports, "HourlyWindow", { enumerable: true, get: function () { return hourly_2.HourlyWindow; } });
var daily_2 = require("./daily");
Object.defineProperty(exports, "DailyWindow", { enumerable: true, get: function () { return daily_2.DailyWindow; } });
var monthly_2 = require("./monthly");
Object.defineProperty(exports, "MonthlyWindow", { enumerable: true, get: function () { return monthly_2.MonthlyWindow; } });
var custom_2 = require("./custom");
Object.defineProperty(exports, "CustomDurationWindow", { enumerable: true, get: function () { return custom_2.CustomDurationWindow; } });
//# sourceMappingURL=index.js.map