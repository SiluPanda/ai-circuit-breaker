import type { CircuitState, WindowType, CustomWindow } from './types';
export interface BreachedThreshold {
    window: WindowType | CustomWindow;
    limit: number;
    spent: number;
}
export declare class StateMachine {
    private readonly probeCount;
    private readonly cooldownMs;
    private state;
    private breachedThreshold;
    private probesRemaining;
    private openedAt;
    constructor(probeCount?: number, cooldownMs?: number, initialState?: CircuitState);
    getState(): CircuitState;
    getBreachedThreshold(): BreachedThreshold | null;
    getProbesRemaining(): number;
    /** Transition closed -> open when a threshold is breached. */
    tripOpen(threshold: BreachedThreshold): void;
    /**
     * Check if we should transition open -> half-open.
     * Called lazily on each interaction.
     * Returns true if transition occurred.
     */
    tryTransitionToHalfOpen(now?: number): boolean;
    /** Consume a probe in half-open state. Returns true if probe was available. */
    consumeProbe(): boolean;
    /** Transition half-open -> closed when probes succeed. */
    closeCircuit(): void;
    /** Manual reset from any state. */
    reset(): void;
    /** Check if the circuit is allowing calls through. */
    isCallAllowed(): boolean;
}
//# sourceMappingURL=state-machine.d.ts.map