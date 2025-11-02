/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by failing fast when an agent is down
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not attempting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close circuit from half-open
  timeout: number;               // How long to wait before trying again (ms)
  monitoringPeriod: number;      // Time window for counting failures (ms)
}

interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastAttemptTime: number | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,           // Open after 5 failures
  successThreshold: 2,           // Close after 2 successes
  timeout: 60000,                // Wait 60s before retry
  monitoringPeriod: 120000       // 2-minute rolling window
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private metrics: CircuitMetrics = {
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    lastAttemptTime: null
  };
  private config: CircuitBreakerConfig;
  private agentId: string;

  constructor(agentId: string, config?: Partial<CircuitBreakerConfig>) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        console.log(`[CircuitBreaker] ${this.agentId}: Attempting reset (HALF_OPEN)`);
        this.state = CircuitState.HALF_OPEN;
      } else {
        console.log(`[CircuitBreaker] ${this.agentId}: Circuit OPEN, failing fast`);
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker OPEN for ${this.agentId}`);
      }
    }

    // Attempt execution
    this.metrics.lastAttemptTime = Date.now();

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.cleanOldMetrics();

    if (this.state === CircuitState.HALF_OPEN) {
      this.metrics.successes++;
      console.log(`[CircuitBreaker] ${this.agentId}: Success in HALF_OPEN (${this.metrics.successes}/${this.config.successThreshold})`);

      if (this.metrics.successes >= this.config.successThreshold) {
        this.reset();
        console.log(`[CircuitBreaker] ${this.agentId}: Circuit CLOSED (service recovered)`);
      }
    } else {
      // In CLOSED state, reset failure count on success
      this.metrics.failures = 0;
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.cleanOldMetrics();
    this.metrics.failures++;
    this.metrics.lastFailureTime = Date.now();

    console.log(`[CircuitBreaker] ${this.agentId}: Failure recorded (${this.metrics.failures}/${this.config.failureThreshold})`);

    if (this.state === CircuitState.HALF_OPEN) {
      // If fails in HALF_OPEN, immediately open circuit again
      this.state = CircuitState.OPEN;
      console.log(`[CircuitBreaker] ${this.agentId}: Circuit OPEN again (failed in HALF_OPEN)`);
    } else if (this.metrics.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log(`[CircuitBreaker] ${this.agentId}: Circuit OPEN (threshold exceeded)`);
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.metrics.lastFailureTime) return true;

    const timeSinceFailure = Date.now() - this.metrics.lastFailureTime;
    return timeSinceFailure >= this.config.timeout;
  }

  /**
   * Clean metrics older than monitoring period
   */
  private cleanOldMetrics(): void {
    const now = Date.now();
    if (this.metrics.lastFailureTime && now - this.metrics.lastFailureTime > this.config.monitoringPeriod) {
      this.metrics.failures = 0;
    }
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastAttemptTime: null
    };
  }

  /**
   * Get current state and metrics (for monitoring)
   */
  getStatus() {
    return {
      agentId: this.agentId,
      state: this.state,
      failures: this.metrics.failures,
      successes: this.metrics.successes,
      lastFailureTime: this.metrics.lastFailureTime
    };
  }
}

/**
 * Circuit Breaker Registry
 * Maintains one circuit breaker per agent
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  get(agentId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(agentId)) {
      this.breakers.set(agentId, new CircuitBreaker(agentId, config));
    }
    return this.breakers.get(agentId)!;
  }

  getAll(): Array<{ agentId: string; status: ReturnType<CircuitBreaker['getStatus']> }> {
    return Array.from(this.breakers.entries()).map(([id, breaker]) => ({
      agentId: id,
      status: breaker.getStatus()
    }));
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
