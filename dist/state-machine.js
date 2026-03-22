"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachine = void 0;
class StateMachine {
    probeCount;
    cooldownMs;
    state = 'closed';
    breachedThreshold = null;
    probesRemaining;
    openedAt = null;
    constructor(probeCount = 1, cooldownMs = 5000, initialState = 'closed') {
        this.probeCount = probeCount;
        this.cooldownMs = cooldownMs;
        this.state = initialState;
        this.probesRemaining = probeCount;
    }
    getState() { return this.state; }
    getBreachedThreshold() { return this.breachedThreshold; }
    getProbesRemaining() { return this.probesRemaining; }
    /** Transition closed -> open when a threshold is breached. */
    tripOpen(threshold) {
        if (this.state !== 'closed' && this.state !== 'half-open')
            return;
        this.state = 'open';
        this.breachedThreshold = threshold;
        this.openedAt = Date.now();
        this.probesRemaining = this.probeCount;
    }
    /**
     * Check if we should transition open -> half-open.
     * Called lazily on each interaction.
     * Returns true if transition occurred.
     */
    tryTransitionToHalfOpen(now = Date.now()) {
        if (this.state !== 'open')
            return false;
        if (this.openedAt !== null && (now - this.openedAt) < this.cooldownMs)
            return false;
        this.state = 'half-open';
        this.probesRemaining = this.probeCount;
        return true;
    }
    /** Consume a probe in half-open state. Returns true if probe was available. */
    consumeProbe() {
        if (this.state !== 'half-open')
            return false;
        if (this.probesRemaining <= 0)
            return false;
        this.probesRemaining--;
        return true;
    }
    /** Transition half-open -> closed when probes succeed. */
    closeCircuit() {
        this.state = 'closed';
        this.breachedThreshold = null;
        this.openedAt = null;
        this.probesRemaining = this.probeCount;
    }
    /** Manual reset from any state. */
    reset() {
        this.state = 'closed';
        this.breachedThreshold = null;
        this.openedAt = null;
        this.probesRemaining = this.probeCount;
    }
    /** Check if the circuit is allowing calls through. */
    isCallAllowed() {
        return this.state === 'closed' || (this.state === 'half-open' && this.probesRemaining > 0);
    }
}
exports.StateMachine = StateMachine;
//# sourceMappingURL=state-machine.js.map