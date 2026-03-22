"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackHandler = void 0;
const budget_exceeded_error_1 = require("./budget-exceeded-error");
class FallbackHandler {
    config;
    cachedResponse = undefined;
    hasCachedResponse = false;
    constructor(config) {
        this.config = config;
    }
    /** Cache the latest successful response (for 'cached' strategy). */
    cacheResponse(response) {
        this.cachedResponse = response;
        this.hasCachedResponse = true;
    }
    /** Execute the fallback strategy. */
    async execute(args, context) {
        switch (this.config.strategy) {
            case 'throw':
                throw new budget_exceeded_error_1.BudgetExceededError(context.threshold, context.resetsIn, context.circuitState);
            case 'cached':
                if (this.hasCachedResponse)
                    return this.cachedResponse;
                throw new budget_exceeded_error_1.BudgetExceededError(context.threshold, context.resetsIn, context.circuitState);
            case 'downgrade':
                return this.config.fn(args);
            case 'custom':
                return this.config.fn(args, context.state);
        }
    }
}
exports.FallbackHandler = FallbackHandler;
//# sourceMappingURL=fallback.js.map