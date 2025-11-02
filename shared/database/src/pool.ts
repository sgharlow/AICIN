/**
 * Database Connection Pool
 * Shared PostgreSQL connection pool for all agents
 * Compatible with AWS RDS and Google Cloud SQL
 */

import { Pool, PoolClient, PoolConfig } from 'pg';

let pool: Pool | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Initialize database connection pool
 * Call this once at agent startup
 */
export function initializePool(config: DatabaseConfig): Pool {
  if (pool) {
    console.warn('[Database] Pool already initialized');
    return pool;
  }

  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.maxConnections || 5,
    idleTimeoutMillis: config.idleTimeoutMs || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMs || 10000,
  };

  pool = new Pool(poolConfig);

  // Error handling
  pool.on('error', (err) => {
    console.error('[Database] Unexpected pool error:', err);
  });

  pool.on('connect', (client) => {
    console.log('[Database] New client connected to pool');
  });

  console.log('[Database] Pool initialized successfully');
  return pool;
}

/**
 * Get existing pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('[Database] Pool not initialized. Call initializePool() first.');
  }
  return pool;
}

/**
 * Close pool and release all connections
 * Call this during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log('[Database] Closing connection pool...');
    await pool.end();
    pool = null;
    console.log('[Database] Pool closed successfully');
  }
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    console.log('[Database] Query executed', {
      duration: `${duration}ms`,
      rows: result.rowCount,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0
    };
  } catch (error) {
    console.error('[Database] Query error:', error);
    console.error('[Database] Query:', text);
    console.error('[Database] Params:', params);
    throw error;
  }
}

/**
 * Execute queries within a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[Database] Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    console.log('[Database] Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Database] Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check - verify database connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as now');
    console.log('[Database] Health check passed:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}
