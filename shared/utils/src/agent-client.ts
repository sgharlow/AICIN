/**
 * Agent Communication Client
 * HTTP client for inter-agent communication
 */

import type { AgentMessage } from '@aicin/types';
import { circuitBreakerRegistry } from './circuit-breaker';

export interface AgentClientConfig {
  agentUrls: Record<string, string>; // agentId -> base URL
  timeout?: number;
  retries?: number;
}

let config: AgentClientConfig | null = null;

/**
 * Initialize agent client
 */
export function initializeAgentClient(clientConfig: AgentClientConfig): void {
  config = clientConfig;
  console.log('[AgentClient] Initialized with agents:', Object.keys(clientConfig.agentUrls));
}

/**
 * Get agent client config
 */
function getConfig(): AgentClientConfig {
  if (!config) {
    throw new Error('[AgentClient] Not initialized. Call initializeAgentClient() first.');
  }
  return config;
}

/**
 * Invoke an agent with retry logic
 */
export async function invokeAgent<TPayload, TResult>(
  agentId: string,
  payload: TPayload,
  correlationId: string,
  sourceAgentId: string
): Promise<TResult> {
  const cfg = getConfig();
  const baseUrl = cfg.agentUrls[agentId];

  if (!baseUrl) {
    throw new Error(`[AgentClient] Unknown agent: ${agentId}`);
  }

  const message: AgentMessage<TPayload> = {
    agentId: sourceAgentId,
    correlationId,
    timestamp: new Date(),
    payload,
    metadata: {
      version: 'v1'
    }
  };

  const maxRetries = cfg.retries || 2;
  const timeout = cfg.timeout || 30000;

  // Get circuit breaker for this agent
  const circuitBreaker = circuitBreakerRegistry.get(agentId, {
    failureThreshold: 5,
    timeout: 60000  // 60s before retry
  });

  // Execute with circuit breaker protection
  return await circuitBreaker.execute(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AgentClient] Invoking ${agentId} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${baseUrl}/invoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Source-Agent': sourceAgentId
          },
          body: JSON.stringify(message),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Agent ${agentId} returned ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        console.log(`[AgentClient] ${agentId} invoked successfully`);

        return result as TResult;

      } catch (error) {
        lastError = error as Error;
        console.error(`[AgentClient] Error invoking ${agentId}:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`[AgentClient] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`[AgentClient] Failed to invoke ${agentId} after ${maxRetries + 1} attempts: ${lastError?.message}`);
  });
}

/**
 * Invoke multiple agents in parallel
 */
export async function invokeAgentsParallel<TResult>(
  invocations: Array<{
    agentId: string;
    payload: any;
  }>,
  correlationId: string,
  sourceAgentId: string
): Promise<TResult[]> {
  console.log(`[AgentClient] Invoking ${invocations.length} agents in parallel`);

  const promises = invocations.map(inv =>
    invokeAgent<any, TResult>(inv.agentId, inv.payload, correlationId, sourceAgentId)
  );

  return await Promise.all(promises);
}
