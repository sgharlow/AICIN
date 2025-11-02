/**
 * Shared Utilities Module
 * Exports all utility functions
 */

export * from './auth';
export * from './cache';
export * from './agent-client';
export * from './gemini';
export * from './secrets';
export * from './circuit-breaker';

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Hash quiz answers for cache key generation
 */
export function hashQuizAnswers(answers: any): string {
  const sorted = JSON.stringify(answers, Object.keys(answers).sort());
  return Buffer.from(sorted).toString('base64').substring(0, 32);
}

/**
 * Calculate confidence level based on score and data quality
 */
export function calculateConfidence(
  score: number,
  completenessScore: number,
  validationPass: boolean,
  reasonCount: number
): 'low' | 'medium' | 'high' {
  if (score >= 0.8 && completenessScore >= 80 && validationPass && reasonCount >= 3) {
    return 'high';
  }
  if (score >= 0.6 && completenessScore >= 50 && reasonCount >= 2) {
    return 'medium';
  }
  return 'low';
}

/**
 * Parse budget range from quiz answer
 */
export function parseBudget(budget: string): { min: number; max: number } {
  const map: Record<string, { min: number; max: number }> = {
    '$0': { min: 0, max: 0 },
    '$0-100': { min: 0, max: 100 },
    '$100-500': { min: 100, max: 500 },
    '$500+': { min: 500, max: 10000 },
  };
  return map[budget] || { min: 0, max: 100 };
}

/**
 * Parse availability hours from quiz answer
 */
export function parseAvailability(avail: string): number {
  const map: Record<string, number> = {
    '0-5h': 3,
    '5-10h': 7,
    '10-20h': 15,
    '20+h': 25
  };
  return map[avail] || 10;
}
