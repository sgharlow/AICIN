/**
 * Google Secret Manager Integration
 * Secure secret management without environment variables
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Singleton client
let secretClient: SecretManagerServiceClient | null = null;

// Cache secrets in memory (valid for container lifetime)
const secretCache = new Map<string, string>();

/**
 * Initialize Secret Manager client
 */
function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

/**
 * Fetch a secret from Google Secret Manager
 * @param secretName Name of the secret (e.g., 'aicin-jwt-secret')
 * @param version Version to fetch (default: 'latest')
 * @returns Secret value as string
 */
export async function getSecret(secretName: string, version: string = 'latest'): Promise<string> {
  // Check cache first
  const cacheKey = `${secretName}:${version}`;
  if (secretCache.has(cacheKey)) {
    return secretCache.get(cacheKey)!;
  }

  // Fetch from Secret Manager
  const projectId = process.env.GCP_PROJECT || 'aicin-477004';
  const secretPath = `projects/${projectId}/secrets/${secretName}/versions/${version}`;

  try {
    const client = getSecretClient();
    const [accessResponse] = await client.accessSecretVersion({ name: secretPath });

    const secretValue = accessResponse.payload?.data?.toString() || '';

    if (!secretValue) {
      throw new Error(`Secret ${secretName} is empty`);
    }

    // Cache for container lifetime
    secretCache.set(cacheKey, secretValue);

    console.log(`[Secrets] Fetched secret: ${secretName}`);
    return secretValue;

  } catch (error) {
    console.error(`[Secrets] Failed to fetch secret ${secretName}:`, error);
    throw new Error(`Failed to fetch secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get JWT secret (primary use case for AICIN)
 * Falls back to environment variable for local development
 */
export async function getJWTSecret(): Promise<string> {
  // In local development, allow env var fallback
  if (process.env.NODE_ENV === 'development' && process.env.JWT_SECRET) {
    console.log('[Secrets] Using JWT_SECRET from environment (development mode)');
    return process.env.JWT_SECRET;
  }

  // In production, always use Secret Manager
  return getSecret('jwt-secret');
}

/**
 * Clear secret cache (useful for testing)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
