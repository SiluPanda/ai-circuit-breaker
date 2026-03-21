import type { CircuitState, WindowType, CustomWindow } from './types';

export interface BreachedThreshold {
  window: WindowType | CustomWindow;
  limit: number;
  spent: number;
}

export class StateMachine {
  private state: CircuitState = 'closed';
  private breachedThreshold: BreachedThreshold | null = null;
  private probesRemaining: number;
  private openedAt: number | null = null;

  constructor(
    private readonly probeCount: number = 1,
    private readonly cooldownMs: number = 5000,
    initialState: CircuitState = 'closed',
  ) {
    this.state = initialState;
    this.probesRemaining = probeCount;
  }

  getState(): CircuitState { return this.state; }
  getBreachedThreshold(): BreachedThreshold | null { return this.breachedThreshold; }
  getProbesRemaining(): number { return this.probesRemaining; }

  /** Transition closed -> open when a threshold is breached. */
  tripOpen(threshold: BreachedThreshold): void {
    if (this.state !== 'closed' && this.state !== 'half-open') return;
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
  tryTransitionToHalfOpen(now: number = Date.now()): boolean {
    if (this.state !== 'open') return false;
    if (this.openedAt !== null && (now - this.openedAt) < this.cooldownMs) return false;
    this.state = 'half-open';
    this.probesRemaining = this.probeCount;
    return true;
  }

  /** Consume a probe in half-open state. Returns true if probe was available. */
  consumeProbe(): boolean {
    if (this.state !== 'half-open') return false;
    if (this.probesRemaining <= 0) return false;
    this.probesRemaining--;
    return true;
  }

  /** Transition half-open -> closed when probes succeed. */
  closeCircuit(): void {
    this.state = 'closed';
    this.breachedThreshold = null;
    this.openedAt = null;
    this.probesRemaining = this.probeCount;
  }

  /** Manual reset from any state. */
  reset(): void {
    this.state = 'closed';
    this.breachedThreshold = null;
    this.openedAt = null;
    this.probesRemaining = this.probeCount;
  }

  /** Check if the circuit is allowing calls through. */
  isCallAllowed(): boolean {
    return this.state === 'closed' || (this.state === 'half-open' && this.probesRemaining > 0);
  }
}
