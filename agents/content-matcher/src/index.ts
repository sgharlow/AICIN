/**
 * AICIN Content Matcher Agent
 * TF-IDF based semantic content matching
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import type {
  AgentMessage,
  ContentMatcherPayload,
  ContentMatcherResult,
  UserProfile,
  LearningPath
} from '@aicin/types';
import { generateCorrelationId, get as cacheGet, set as cacheSet, initializeCache } from '@aicin/utils';
import { ContentAnalyzer } from './content-analyzer';
import { ContentAnalyzerOptimized } from './content-analyzer-optimized';

dotenv.config();

// Database connection pool
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '5')
});

const app = express();
const PORT = parseInt(process.env.PORT || '8082');

// Global content analyzer (reused across requests for performance)
// OPTIMIZED: Use new vectorized analyzer for 5-8x speedup
const USE_OPTIMIZED_ANALYZER = process.env.USE_OPTIMIZED_ANALYZER !== 'false'; // Default: true
let globalAnalyzer: ContentAnalyzer | ContentAnalyzerOptimized | null = null;
let lastCorpusBuildTime: number = 0;
const CORPUS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Query expansion: Map interests to related terms for better TF-IDF matching
// OPTIMIZED: Using top 5 most relevant synonyms per interest (down from 9-10)
// This reduces TF-IDF computation time by ~40% while maintaining quality
const INTEREST_SYNONYMS: Record<string, string[]> = {
  'machine-learning': ['machine learning', 'ML', 'AI', 'neural networks', 'deep learning'],
  'healthcare-ai': ['healthcare', 'medical', 'clinical', 'patient care', 'diagnosis'],
  'nlp': ['natural language processing', 'NLP', 'text analysis', 'language models', 'chatbots'],
  'computer-vision': ['computer vision', 'image recognition', 'object detection', 'facial recognition', 'video analysis'],
  'data-science': ['data science', 'data analysis', 'statistics', 'analytics', 'visualization'],
  'deep-learning': ['deep learning', 'neural networks', 'CNN', 'RNN', 'transformers'],
  'python': ['Python', 'programming', 'coding', 'Pandas', 'NumPy'],
  'cloud': ['cloud computing', 'AWS', 'Azure', 'GCP', 'serverless'],
  'data-engineering': ['data engineering', 'ETL', 'data pipelines', 'big data', 'Spark'],
  'cybersecurity': ['cybersecurity', 'security', 'encryption', 'penetration testing', 'ethical hacking'],
};

/**
 * Expand user interests into related terms for better TF-IDF matching
 */
function expandQuery(interests: string[]): string {
  const expandedTerms: string[] = [];

  interests.forEach(interest => {
    // Add the original interest
    expandedTerms.push(interest);

    // Add synonyms if available
    const synonyms = INTEREST_SYNONYMS[interest.toLowerCase()];
    if (synonyms) {
      expandedTerms.push(...synonyms);
    }
  });

  return expandedTerms.join(' ');
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase payload limit for large path datasets

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

// Diagnostic endpoint to analyze learning path data quality
app.get('/diagnostics', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId as string;

  try {
    console.log(`[${correlationId}] Running diagnostics...`);

    // 1. Completeness score distribution
    const completenessResult = await pool.query(`
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

    // 2. Description length statistics
    const descriptionResult = await pool.query(`
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

    // 3. Sample learning paths
    const samplesResult = await pool.query(`
      SELECT
        document_id,
        title,
        description,
        LENGTH(description) as desc_length,
        completeness_score,
        level,
        topics
      FROM learning_paths
      WHERE description IS NOT NULL AND description != ''
      ORDER BY RANDOM()
      LIMIT 10
    `);

    // 4. Topic distribution
    const topicsResult = await pool.query(`
      SELECT
        COUNT(CASE WHEN topics IS NOT NULL AND topics != '[]' THEN 1 END) as paths_with_topics,
        COUNT(CASE WHEN topics IS NULL OR topics = '[]' THEN 1 END) as paths_without_topics
      FROM learning_paths
    `);

    const diagnostics = {
      timestamp: new Date().toISOString(),
      completeness: completenessResult.rows[0],
      descriptions: descriptionResult.rows[0],
      topics: topicsResult.rows[0],
      samples: samplesResult.rows.map((row: any) => ({
        id: row.document_id,
        title: row.title,
        descriptionPreview: row.description?.substring(0, 200) + '...',
        descriptionLength: row.desc_length,
        completenessScore: row.completeness_score,
        level: row.level,
        topicsCount: Array.isArray(row.topics) ? row.topics.length : 0
      }))
    };

    console.log(`[${correlationId}] Diagnostics complete`);
    res.json(diagnostics);

  } catch (error) {
    console.error(`[${correlationId}] Diagnostics error:`, error);
    res.status(500).json({
      error: 'Diagnostics failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

    // Database diagnostics (log sample paths)
    if (learningPaths.length > 0) {
      console.log(`[${correlationId}] Database Diagnostics:`);
      console.log(`  Total paths in corpus: ${learningPaths.length}`);

      // Sample first 3 paths
      const samples = learningPaths.slice(0, 3);
      samples.forEach((path, idx) => {
        const descLength = path.description?.length || 0;
        const topicsCount = Array.isArray(path.topics) ? path.topics.length : 0;
        console.log(`  Path ${idx + 1}: "${path.title?.substring(0, 50)}${path.title?.length > 50 ? '...' : ''}"`);
        console.log(`    Description: ${descLength} chars | Topics: ${topicsCount}`);
      });
    }

    // Generate expanded query from user interests
    const rawQuery = userProfile.interests.join(' ');
    const expandedQuery = expandQuery(userProfile.interests);
    console.log(`[${correlationId}] User Query:`);
    console.log(`  Raw interests: ${JSON.stringify(userProfile.interests)}`);
    console.log(`  Raw query: "${rawQuery}"`);
    console.log(`  Expanded query (${expandedQuery.split(' ').length} terms): "${expandedQuery.substring(0, 150)}..."`);

    const query = expandedQuery;

    // Calculate content scores for all paths
    // OPTIMIZED: Disable debug logging in production for better performance
    const enableDebug = process.env.TFIDF_DEBUG === 'true' && process.env.NODE_ENV !== 'production';
    const contentScores = analyzer.calculateAllScores(query, enableDebug);

    // Get top matches
    const topMatches = analyzer.getTopMatches(query, 20);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[${correlationId}] Content matching complete in ${processingTimeMs}ms`);

    // Log top 5 scores for comparison
    console.log(`[${correlationId}] Top 5 TF-IDF scores:`);
    topMatches.slice(0, 5).forEach((match, idx) => {
      const path = learningPaths.find(p => p.id.toString() === match.pathId);
      console.log(`  ${idx + 1}. Score: ${match.score.toFixed(4)} | Path: ${path?.title?.substring(0, 40) || match.pathId}`);
    });

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
): Promise<ContentAnalyzer | ContentAnalyzerOptimized> {
  const now = Date.now();

  // Check if we can reuse global analyzer
  if (globalAnalyzer && (now - lastCorpusBuildTime) < CORPUS_CACHE_TTL) {
    const analyzerType = USE_OPTIMIZED_ANALYZER ? 'OPTIMIZED' : 'standard';
    console.log(`[${correlationId}] Reusing cached TF-IDF corpus (${analyzerType}, age: ${Math.floor((now - lastCorpusBuildTime) / 1000)}s)`);
    return globalAnalyzer;
  }

  // Build new analyzer
  console.log(`[${correlationId}] Building new TF-IDF corpus (${USE_OPTIMIZED_ANALYZER ? 'OPTIMIZED' : 'standard'})...`);
  const buildStart = Date.now();

  const analyzer = USE_OPTIMIZED_ANALYZER
    ? new ContentAnalyzerOptimized()
    : new ContentAnalyzer();

  analyzer.buildCorpus(learningPaths);

  const buildTime = Date.now() - buildStart;
  console.log(`[${correlationId}] Corpus built in ${buildTime}ms`);

  // Cache globally
  globalAnalyzer = analyzer;
  lastCorpusBuildTime = now;

  return analyzer;
}
