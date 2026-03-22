"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetExceededError = void 0;
class BudgetExceededError extends Error {
    threshold;
    resetsIn;
    circuitState;
    name = 'BudgetExceededError';
    constructor(threshold, resetsIn, circuitState) {
        const windowLabel = typeof threshold.window === 'string'
            ? threshold.window
            : `custom(${threshold.window.durationMs}ms)`;
        super(`Budget exceeded: spent $${threshold.spent.toFixed(2)} of $${threshold.limit.toFixed(2)} ${windowLabel} budget. ` +
            `Circuit is ${circuitState}. Resets in ${Math.ceil(resetsIn / 1000)}s.`);
        this.threshold = threshold;
        this.resetsIn = resetsIn;
        this.circuitState = circuitState;
        Object.setPrototypeOf(this, BudgetExceededError.prototype);
    }
}
exports.BudgetExceededError = BudgetExceededError;
//# sourceMappingURL=budget-exceeded-error.js.map