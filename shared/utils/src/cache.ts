/**
 * Redis Cache Manager
 * Shared caching layer using Memorystore Redis
 */

import Redis from 'ioredis';
import type { CacheEntry } from '@aicin/types';

let redis: Redis | null = null;

export interface CacheConfig {
  host: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Initialize Redis connection
 */
export function initializeCache(config: CacheConfig): Redis {
  if (redis) {
    console.warn('[Cache] Redis already initialized');
    return redis;
  }

  redis = new Redis({
    host: config.host,
    port: config.port || 6379,
    password: config.password,
    db: config.db || 0,
    keyPrefix: config.keyPrefix || 'aicin:',
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => {
    console.log('[Cache] Connected to Redis');
  });

  redis.on('error', (err) => {
    console.error('[Cache] Redis error:', err);
  });

  console.log('[Cache] Redis initialized successfully');
  return redis;
}

/**
 * Get Redis instance
 */
export function getCache(): Redis {
  if (!redis) {
    throw new Error('[Cache] Redis not initialized. Call initializeCache() first.');
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redis) {
    console.log('[Cache] Closing Redis connection...');
    await redis.quit();
    redis = null;
    console.log('[Cache] Redis connection closed');
  }
}

/**
 * Set cache entry with TTL
 */
export async function set<T>(
  key: string,
  data: T,
  ttlSeconds: number,
  version: string = 'v1'
): Promise<void> {
  const redis = getCache();

  const entry: CacheEntry<T> = {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + (ttlSeconds * 1000),
    version,
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(entry));
  console.log(`[Cache] Set key: ${key} (TTL: ${ttlSeconds}s)`);
}

/**
 * Get cache entry
 */
export async function get<T>(key: string): Promise<T | null> {
  const redis = getCache();
  const raw = await redis.get(key);

  if (!raw) {
    console.log(`[Cache] Miss: ${key}`);
    return null;
  }

  try {
    const entry: CacheEntry<T> = JSON.parse(raw);

    // Check if expired (belt and suspenders)
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      console.log(`[Cache] Expired: ${key}`);
      await del(key);
      return null;
    }

    console.log(`[Cache] Hit: ${key}`);
    return entry.data;
  } catch (error) {
    console.error(`[Cache] Parse error for key ${key}:`, error);
    await del(key);
    return null;
  }
}

/**
 * Delete cache entry
 */
export async function del(key: string): Promise<void> {
  const redis = getCache();
  await redis.del(key);
  console.log(`[Cache] Deleted: ${key}`);
}

/**
 * Delete all keys matching pattern
 */
export async function delPattern(pattern: string): Promise<number> {
  const redis = getCache();
  const keys = await redis.keys(pattern);

  if (keys.length === 0) {
    return 0;
  }

  await redis.del(...keys);
  console.log(`[Cache] Deleted ${keys.length} keys matching: ${pattern}`);
  return keys.length;
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  const redis = getCache();
  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Get TTL for a key
 */
export async function ttl(key: string): Promise<number> {
  const redis = getCache();
  return await redis.ttl(key);
}

/**
 * Increment counter
 */
export async function incr(key: string): Promise<number> {
  const redis = getCache();
  return await redis.incr(key);
}

/**
 * Set counter with expiry
 */
export async function incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
  const redis = getCache();
  const value = await redis.incr(key);

  if (value === 1) {
    // First increment, set TTL
    await redis.expire(key, ttlSeconds);
  }

  return value;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const redis = getCache();
    await redis.ping();
    console.log('[Cache] Health check passed');
    return true;
  } catch (error) {
    console.error('[Cache] Health check failed:', error);
    return false;
  }
}
