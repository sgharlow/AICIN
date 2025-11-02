/**
 * AICIN Content Matcher Agent
 * TF-IDF based semantic content matching
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type {
  AgentMessage,
  ContentMatcherPayload,
  ContentMatcherResult,
  UserProfile,
  LearningPath
} from '@aicin/types';
import { generateCorrelationId, get as cacheGet, set as cacheSet, initializeCache } from '@aicin/utils';
import { ContentAnalyzer } from './content-analyzer';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8082');

// Global content analyzer (reused across requests for performance)
let globalAnalyzer: ContentAnalyzer | null = null;
let lastCorpusBuildTime: number = 0;
const CORPUS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

app.use(cors());
app.use(express.json());

// Initialize cache if Redis is available
if (process.env.REDIS_HOST) {
  try {
    initializeCache({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'content-matcher:'
    });
    console.log('[ContentMatcher] Cache initialized');
  } catch (error) {
    console.warn('[ContentMatcher] Cache initialization failed, running without cache:', error);
  }
}

// Request logging
app.use((req: Request, res: Response, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  (req as any).correlationId = correlationId;
  console.log(`[${correlationId}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    agent: 'content-matcher',
    timestamp: new Date().toISOString(),
    corpusSize: globalAnalyzer?.getCorpusSize() || 0,
    corpusCached: globalAnalyzer !== null
  });
});

// Agent invocation endpoint
app.post('/invoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    const message = req.body as AgentMessage<ContentMatcherPayload>;
    const { userProfile, learningPaths } = message.payload;

    console.log(`[${correlationId}] Matching content for ${learningPaths.length} paths`);

    // Build or reuse TF-IDF corpus
    const analyzer = await getOrBuildAnalyzer(learningPaths, correlationId);

    // Generate query from user interests
    const query = userProfile.interests.join(' ');
    console.log(`[${correlationId}] Query: "${query}"`);

    // Calculate content scores for all paths
    const contentScores = analyzer.calculateAllScores(query);

    // Get top matches
    const topMatches = analyzer.getTopMatches(query, 20);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[${correlationId}] Content matching complete in ${processingTimeMs}ms`);

    // Convert Map to object for JSON serialization
    const contentScoresObj: Record<string, number> = {};
    contentScores.forEach((score, pathId) => {
      contentScoresObj[pathId] = score;
    });

    const result: ContentMatcherResult = {
      contentScores: contentScoresObj as any, // Type assertion for serialization
      topMatches
    };

    res.json(result);

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Content matching failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ContentMatcher] SIGTERM received, shutting down...');
  globalAnalyzer = null;
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[ContentMatcher] Server listening on port ${PORT}`);
});

export default app;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or build TF-IDF analyzer with caching
 */
async function getOrBuildAnalyzer(
  learningPaths: Array<{ id: number | string; title: string; description?: string; topics?: string[] }>,
  correlationId: string
): Promise<ContentAnalyzer> {
  const now = Date.now();

  // Check if we can reuse global analyzer
  if (globalAnalyzer && (now - lastCorpusBuildTime) < CORPUS_CACHE_TTL) {
    console.log(`[${correlationId}] Reusing cached TF-IDF corpus (age: ${Math.floor((now - lastCorpusBuildTime) / 1000)}s)`);
    return globalAnalyzer;
  }

  // Check Redis cache for pre-built corpus (future enhancement)
  // For now, we rebuild in memory

  console.log(`[${correlationId}] Building new TF-IDF corpus...`);
  const buildStart = Date.now();

  const analyzer = new ContentAnalyzer();
  analyzer.buildCorpus(learningPaths);

  const buildTime = Date.now() - buildStart;
  console.log(`[${correlationId}] Corpus built in ${buildTime}ms`);

  // Cache globally
  globalAnalyzer = analyzer;
  lastCorpusBuildTime = now;

  return analyzer;
}
