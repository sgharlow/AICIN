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

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*']; // Default: allow all origins (for development/hackathon)

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Allow all origins if * is configured
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject origin
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
};

console.log(`[Orchestrator] CORS configured with origins: ${allowedOrigins.join(', ')}`);

// Middleware
app.use(cors(corsOptions));
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

// Diagnostic endpoint to analyze learning path data quality
app.get('/diagnostics', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId as string;

  try {
    console.log(`[${correlationId}] Running diagnostics...`);
    const { query } = await import('@aicin/database');

    // 0. First, get table schema to see what columns actually exist
    console.log(`[${correlationId}] Querying schema...`);
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'learning_paths'
      ORDER BY ordinal_position
    `);

    const columns = schemaResult.rows.map((row: any) => row.column_name);
    console.log(`[${correlationId}] Found columns:`, columns);

    // Check which columns we need actually exist
    const hasCompletenessScore = columns.includes('completeness_score');
    const hasDescription = columns.includes('description');
    const hasLevel = columns.includes('level') || columns.includes('experience_level') || columns.includes('difficulty');
    const hasDocumentId = columns.includes('document_id') || columns.includes('id');
    const hasTitle = columns.includes('title') || columns.includes('name');

    // 1. Basic count and completeness score distribution (if available)
    let completenessResult;
    if (hasCompletenessScore) {
      console.log(`[${correlationId}] Querying completeness scores...`);
      completenessResult = await query(`
        SELECT
          COUNT(*) as total_paths,
          AVG(completeness_score) as avg_completeness,
          MIN(completeness_score) as min_completeness,
          MAX(completeness_score) as max_completeness,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY completeness_score) as p25_completeness,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY completeness_score) as p50_completeness,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY completeness_score) as p75_completeness,
          COUNT(CASE WHEN completeness_score < 40 THEN 1 END) as paths_below_40,
          COUNT(CASE WHEN completeness_score >= 40 AND completeness_score < 70 THEN 1 END) as paths_40_70,
          COUNT(CASE WHEN completeness_score >= 70 THEN 1 END) as paths_above_70
        FROM learning_paths
      `);
    } else {
      console.log(`[${correlationId}] No completeness_score column, querying basic count...`);
      completenessResult = await query(`
        SELECT COUNT(*) as total_paths FROM learning_paths
      `);
    }

    // 2. Description length statistics (if available)
    let descriptionResult;
    if (hasDescription) {
      console.log(`[${correlationId}] Querying description lengths...`);
      descriptionResult = await query(`
        SELECT
          AVG(LENGTH(description)) as avg_desc_length,
          MIN(LENGTH(description)) as min_desc_length,
          MAX(LENGTH(description)) as max_desc_length,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY LENGTH(description)) as median_desc_length,
          COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_descriptions,
          COUNT(CASE WHEN LENGTH(description) < 100 THEN 1 END) as very_short_desc,
          COUNT(CASE WHEN LENGTH(description) >= 100 AND LENGTH(description) < 300 THEN 1 END) as short_desc,
          COUNT(CASE WHEN LENGTH(description) >= 300 AND LENGTH(description) < 500 THEN 1 END) as medium_desc,
          COUNT(CASE WHEN LENGTH(description) >= 500 THEN 1 END) as long_desc
        FROM learning_paths
        WHERE description IS NOT NULL
      `);
    }

    // 3. Sample learning paths (build query based on available columns)
    let sampleQuery = 'SELECT ';
    const selectColumns: string[] = [];
    if (hasDocumentId) selectColumns.push('document_id');
    if (hasTitle) selectColumns.push('title');
    if (hasDescription) selectColumns.push('description', 'LENGTH(description) as desc_length');
    if (hasCompletenessScore) selectColumns.push('completeness_score');
    if (hasLevel) {
      if (columns.includes('level')) selectColumns.push('level');
      else if (columns.includes('experience_level')) selectColumns.push('experience_level as level');
      else if (columns.includes('difficulty')) selectColumns.push('difficulty as level');
    }

    sampleQuery += selectColumns.join(', ');
    sampleQuery += ' FROM learning_paths';
    if (hasDescription) sampleQuery += ' WHERE description IS NOT NULL AND description != \'\'';
    sampleQuery += ' ORDER BY RANDOM() LIMIT 10';

    console.log(`[${correlationId}] Querying samples with: ${sampleQuery}`);
    const samplesResult = await query(sampleQuery);

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      schema: schemaResult.rows,
      columnsFound: {
        completeness_score: hasCompletenessScore,
        description: hasDescription,
        level: hasLevel,
        document_id: hasDocumentId,
        title: hasTitle
      }
    };

    if (completenessResult) {
      diagnostics.completeness = completenessResult.rows[0];
    }

    if (descriptionResult) {
      diagnostics.descriptions = descriptionResult.rows[0];
    }

    diagnostics.samples = samplesResult.rows.map((row: any) => {
      const sample: any = {};
      if (row.document_id) sample.id = row.document_id;
      if (row.title) sample.title = row.title;
      if (row.description) {
        sample.descriptionPreview = row.description.substring(0, 200) + (row.description.length > 200 ? '...' : '');
        sample.descriptionLength = row.desc_length;
      }
      if (row.completeness_score !== undefined) sample.completenessScore = row.completeness_score;
      if (row.level) sample.level = row.level;
      return sample;
    });

    console.log(`[${correlationId}] Diagnostics complete`);
    res.json(diagnostics);

  } catch (error) {
    console.error(`[${correlationId}] Diagnostics error:`, error);
    res.status(500).json({
      error: 'Diagnostics failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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
