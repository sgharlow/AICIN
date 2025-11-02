/**
 * AICIN Orchestrator Agent
 * API Gateway and Multi-Agent Coordination
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializePool, closePool, healthCheck as dbHealthCheck } from '@aicin/database';
import {
  initializeCache,
  closeCache,
  healthCheck as cacheHealthCheck,
  verifyAuthHeader,
  initializeAgentClient,
  generateCorrelationId
} from '@aicin/utils';
import { scoreQuizHandler } from './handlers/score-quiz';
import { getResultsHandler } from './handlers/get-results';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  (req as any).correlationId = correlationId;

  console.log(`[${correlationId}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbOk = await dbHealthCheck();

    // Cache is optional - only check if Redis is configured
    let cacheOk = true;
    let cacheStatus = 'disabled';

    if (process.env.REDIS_HOST) {
      cacheOk = await cacheHealthCheck();
      cacheStatus = cacheOk ? 'ok' : 'failed';
    }

    // Service is healthy if database is OK (cache is optional)
    const healthy = dbOk;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      agent: 'orchestrator',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'failed',
        cache: cacheStatus
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoints
app.post('/api/v1/quiz/score', scoreQuizHandler);
app.get('/api/v1/quiz/results/:submissionId', getResultsHandler);

// Backward compatibility with Lambda endpoint
app.post('/quiz/score', scoreQuizHandler);
app.get('/quiz/results/:submissionId', getResultsHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${(req as any).correlationId}] Error:`, err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Orchestrator] SIGTERM received, shutting down gracefully...');

  // Stop accepting new requests
  server.close(async () => {
    console.log('[Orchestrator] HTTP server closed');

    // Close database pool
    await closePool();

    // Close Redis connection
    await closeCache();

    console.log('[Orchestrator] Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('[Orchestrator] Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

// Initialize connections and start server
async function start() {
  try {
    console.log('[Orchestrator] Starting...');

    // Initialize database
    initializePool({
      host: process.env.DATABASE_HOST!,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME!,
      user: process.env.DATABASE_USERNAME!,
      password: process.env.DATABASE_PASSWORD!,
      ssl: process.env.DATABASE_SSL === 'true',
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '5')
    });

    // Initialize cache (Redis)
    if (process.env.REDIS_HOST) {
      initializeCache({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'aicin:'
      });
      console.log('[Orchestrator] Cache initialized');
    } else {
      console.warn('[Orchestrator] Redis not configured, caching disabled');
    }

    // Initialize agent client
    const agentUrls: Record<string, string> = {};

    if (process.env.PROFILE_ANALYZER_URL) {
      agentUrls['profile-analyzer'] = process.env.PROFILE_ANALYZER_URL;
    }
    if (process.env.CONTENT_MATCHER_URL) {
      agentUrls['content-matcher'] = process.env.CONTENT_MATCHER_URL;
    }
    if (process.env.PATH_OPTIMIZER_URL) {
      agentUrls['path-optimizer'] = process.env.PATH_OPTIMIZER_URL;
    }
    if (process.env.RECOMMENDATION_BUILDER_URL) {
      agentUrls['recommendation-builder'] = process.env.RECOMMENDATION_BUILDER_URL;
    }

    if (Object.keys(agentUrls).length > 0) {
      initializeAgentClient({
        agentUrls,
        timeout: parseInt(process.env.AGENT_TIMEOUT || '30000'),
        retries: parseInt(process.env.AGENT_RETRIES || '2')
      });
      console.log('[Orchestrator] Agent client initialized with agents:', Object.keys(agentUrls));
    } else {
      console.warn('[Orchestrator] No agent URLs configured, will use local processing');
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`[Orchestrator] Server listening on port ${PORT}`);
      console.log(`[Orchestrator] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Orchestrator] Health check: http://localhost:${PORT}/health`);
    });

    return server;

  } catch (error) {
    console.error('[Orchestrator] Failed to start:', error);
    process.exit(1);
  }
}

// Start the server
let server: ReturnType<typeof app.listen>;

(async () => {
  server = await start();
})();

export default app;
