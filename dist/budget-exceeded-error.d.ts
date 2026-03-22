import { CircuitState, WindowType, CustomWindow } from './types';
export declare class BudgetExceededError extends Error {
    readonly threshold: {
        window: WindowType | CustomWindow;
        limit: number;
        spent: number;
    };
    readonly resetsIn: number;
    readonly circuitState: CircuitState;
    readonly name = "BudgetExceededError";
    constructor(threshold: {
        window: WindowType | CustomWindow;
        limit: number;
        spent: number;
    }, resetsIn: number, circuitState: CircuitState);
}
//# sourceMappingURL=budget-exceeded-error.d.ts.map