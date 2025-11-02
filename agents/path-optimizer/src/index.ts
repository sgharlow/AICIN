/**
 * AICIN Path Optimizer Agent
 * 3-Layer scoring system and path ranking
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type {
  AgentMessage,
  PathOptimizerPayload,
  PathOptimizerResult,
  PathMatchResult,
  UserProfile,
  LearningPath,
  Course
} from '@aicin/types';
import { generateCorrelationId } from '@aicin/utils';
import { scorePath, generateMatchReasons } from './scoring';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8083');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Larger limit for course data

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
    agent: 'path-optimizer',
    timestamp: new Date().toISOString()
  });
});

// Agent invocation endpoint
app.post('/invoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    const message = req.body as AgentMessage<PathOptimizerPayload>;
    const { userProfile, contentScores, learningPaths, courses } = message.payload;

    console.log(`[${correlationId}] Optimizing ${learningPaths.length} paths`);

    // Convert contentScores from object to Map
    const contentScoresMap = new Map<string, number>();
    if (contentScores) {
      if (contentScores instanceof Map) {
        contentScores.forEach((score, pathId) => {
          contentScoresMap.set(pathId, score);
        });
      } else {
        Object.entries(contentScores).forEach(([pathId, score]) => {
          contentScoresMap.set(pathId, score as number);
        });
      }
    }

    // Debug logging: Show sample IDs
    console.log(`[${correlationId}] [DEBUG] ContentScores map size: ${contentScoresMap.size}`);
    const sampleScoreKeys = Array.from(contentScoresMap.keys()).slice(0, 3);
    console.log(`[${correlationId}] [DEBUG] Sample contentScore keys: ${sampleScoreKeys.join(', ')}`);

    if (learningPaths.length > 0) {
      const samplePath = learningPaths[0];
      console.log(`[${correlationId}] [DEBUG] Sample path - id: ${samplePath.id}, document_id: ${samplePath.document_id}, title: ${samplePath.title}`);
    }

    // Score each path using 3-layer system
    const rankedPaths: PathMatchResult[] = [];

    for (const path of learningPaths) {
      // Get courses for this path (courses is serialized as object over HTTP)
      const pathCourses: Course[] = (courses as Record<number, Course[]>)[path.id] || [];

      // Calculate score
      const scoring = scorePath(path, pathCourses, userProfile, contentScoresMap);

      // Generate match reasons
      const matchReasons = generateMatchReasons(path, userProfile, scoring.layerBreakdown);

      // Build category breakdown (for backward compatibility)
      const categoryBreakdown: Record<string, number> = {
        contentScore: scoring.layerBreakdown.content,
        metadataScore: scoring.layerBreakdown.metadata,
        courseScore: scoring.layerBreakdown.courses,
        contentWeight: scoring.weights.content,
        metadataWeight: scoring.weights.metadata,
        courseWeight: scoring.weights.courses
      };

      rankedPaths.push({
        pathId: path.id,
        pathTitle: path.title,
        pathSlug: path.slug,
        matchScore: scoring.matchScore,
        confidence: scoring.confidence,
        matchReasons,
        categoryBreakdown,
        layerBreakdown: scoring.layerBreakdown
      });
    }

    // Sort by match score (descending)
    rankedPaths.sort((a, b) => b.matchScore - a.matchScore);

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    const stats = {
      pathsEvaluated: rankedPaths.length,
      averageScore: rankedPaths.reduce((sum, p) => sum + p.matchScore, 0) / rankedPaths.length,
      topScore: rankedPaths[0]?.matchScore || 0
    };

    console.log(`[${correlationId}] Path optimization complete in ${processingTimeMs}ms`);
    console.log(`[${correlationId}] Top score: ${stats.topScore.toFixed(3)}, Average: ${stats.averageScore.toFixed(3)}`);

    const result: PathOptimizerResult = {
      rankedPaths,
      processingStats: stats
    };

    res.json(result);

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Path optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[PathOptimizer] SIGTERM received, shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[PathOptimizer] Server listening on port ${PORT}`);
});

export default app;
