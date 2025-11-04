/**
 * AICIN Recommendation Builder Agent
 * Formats final recommendations with explainability
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type {
  AgentMessage,
  RecommendationBuilderPayload,
  RecommendationBuilderResult,
  RecommendationResponse,
  PathMatchResult,
  UserProfile
} from '@aicin/types';
import { generateCorrelationId } from '@aicin/utils';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8085');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase payload limit for large recommendation sets

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
    agent: 'recommendation-builder',
    timestamp: new Date().toISOString()
  });
});

// Agent invocation endpoint
app.post('/invoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    const message = req.body as AgentMessage<RecommendationBuilderPayload>;
    const { rankedPaths, userProfile, topN = 5 } = message.payload;

    console.log(`[${correlationId}] Building recommendations for top ${topN} paths`);

    // Take top N paths
    const topPaths = rankedPaths.slice(0, topN);

    // Build formatted recommendations
    const recommendations: RecommendationResponse[] = topPaths.map((path, index) => {
      return buildRecommendation(path, userProfile, index + 1);
    });

    const processingTimeMs = Date.now() - startTime;
    console.log(`[${correlationId}] Recommendations built in ${processingTimeMs}ms`);

    const result: RecommendationBuilderResult = {
      recommendations
    };

    res.json(result);

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Recommendation building failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[RecommendationBuilder] SIGTERM received, shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[RecommendationBuilder] Server listening on port ${PORT}`);
});

export default app;

// ============================================================================
// Recommendation Formatting
// ============================================================================

/**
 * Build a single recommendation from path match result
 */
function buildRecommendation(
  path: PathMatchResult,
  userProfile: UserProfile,
  rank: number
): RecommendationResponse {
  // Extract match reasons as strings
  const matchReasons = path.matchReasons.map(r => r.reason);

  // Calculate interests covered
  const pathTopics = path.categoryBreakdown?.topics || [];
  const interestsCovered = userProfile.interests.filter(interest =>
    Array.isArray(pathTopics) && pathTopics.some((topic: any) =>
      String(topic).toLowerCase().includes(interest.toLowerCase()) ||
      interest.toLowerCase().includes(String(topic).toLowerCase())
    )
  );

  // Format interests coverage
  const interestsCoveredCount = `${interestsCovered.length}/${userProfile.interests.length}`;

  // Estimate duration based on weekly hours
  const estimatedHours = path.categoryBreakdown?.estimated_hours ||
    calculateEstimatedHours(path.categoryBreakdown);

  const estimatedWeeks = Math.ceil(estimatedHours / userProfile.weeklyHours);
  const estimatedDuration = formatDuration(estimatedWeeks);

  // Get total cost
  const totalCost = path.categoryBreakdown?.total_cost ||
    path.categoryBreakdown?.totalCost || 0;

  // Get course count
  const courseCount = path.categoryBreakdown?.course_count ||
    path.categoryBreakdown?.courseCount || 0;

  // Determine difficulty level
  const difficultyLevel = determineDifficultyLevel(path.categoryBreakdown);

  return {
    pathId: path.pathId,
    pathTitle: path.pathTitle,
    pathSlug: path.pathSlug,
    rank,
    matchScore: path.matchScore,
    confidence: path.confidence,
    matchReasons,
    categoryBreakdown: path.categoryBreakdown || {},
    validationScores: path.validationScores
  };
}

/**
 * Calculate estimated hours from category breakdown
 */
function calculateEstimatedHours(categoryBreakdown: Record<string, any>): number {
  // Try various field names
  return categoryBreakdown?.estimated_hours ||
    categoryBreakdown?.estimatedHours ||
    categoryBreakdown?.duration_hours ||
    categoryBreakdown?.durationHours ||
    40; // Default 40 hours if unknown
}

/**
 * Format duration in human-readable form
 */
function formatDuration(weeks: number): string {
  if (weeks < 4) {
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  const months = Math.round(weeks / 4);
  if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  }

  const years = Math.round(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

/**
 * Determine difficulty level from category breakdown
 */
function determineDifficultyLevel(categoryBreakdown: Record<string, any>): string {
  // Check various field names
  const level = categoryBreakdown?.level ||
    categoryBreakdown?.difficulty ||
    categoryBreakdown?.difficultyLevel ||
    'Intermediate';

  // Capitalize first letter
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
}
