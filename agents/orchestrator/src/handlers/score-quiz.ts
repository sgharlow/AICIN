/**
 * Score Quiz Handler
 * Main endpoint for quiz submission and path recommendation
 */

import { Request, Response } from 'express';
import { verifyAuthHeader, invokeAgent, get as cacheGet, set as cacheSet, hashQuizAnswers, enrichPathsWithGemini, getJWTSecret } from '@aicin/utils';
import {
  fetchActiveLearningPaths,
  fetchCoursesForPaths,
  saveQuizSubmission,
  saveQuizRecommendations,
  updateUserProfile
} from '@aicin/database';
import type {
  QuizAnswers,
  QuizSubmissionResponse,
  ProfileAnalyzerResult,
  ContentMatcherResult,
  PathOptimizerResult,
  RecommendationBuilderResult,
  PathMatchResult
} from '@aicin/types';
import { localScoreQuiz } from '../local-scorer';

/**
 * POST /api/v1/quiz/score
 * Score quiz and return personalized learning path recommendations
 */
export async function scoreQuizHandler(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    // Verify JWT authentication
    const authHeader = req.headers.authorization as string;

    let JWT_SECRET: string;
    try {
      JWT_SECRET = await getJWTSecret();
    } catch (error) {
      console.warn(`[${correlationId}] Failed to fetch JWT secret from Secret Manager, using fallback:`, error);
      // Fallback to environment variable for demo/hackathon purposes
      JWT_SECRET = process.env.JWT_SECRET || '';
      if (!JWT_SECRET) {
        console.error(`[${correlationId}] No JWT secret available in Secret Manager or environment`);
        res.status(500).json({ error: 'JWT secret not available' });
        return;
      }
    }

    let userId: number;
    try {
      userId = verifyAuthHeader(authHeader, JWT_SECRET);
      console.log(`[${correlationId}] Authenticated user: ${userId}`);
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Invalid token'
      });
      return;
    }

    // Validate request body
    const { answers } = req.body as { answers: QuizAnswers };

    if (!answers) {
      res.status(400).json({
        error: 'Missing quiz answers',
        message: 'Request body must include answers object'
      });
      return;
    }

    // Validate only CRITICAL fields are present
    const criticalFields: (keyof QuizAnswers)[] = ['experienceLevel', 'interests'];
    const missingCritical = criticalFields.filter(field => !answers[field]);

    if (missingCritical.length > 0) {
      res.status(400).json({
        error: 'Missing critical fields',
        message: `Required fields: ${missingCritical.join(', ')}`,
        fields: missingCritical
      });
      return;
    }

    // Validate critical field values
    if (answers.interests.length === 0) {
      res.status(400).json({
        error: 'Invalid interests field',
        message: 'At least one interest must be selected'
      });
      return;
    }

    // Fill in defaults for missing optional fields
    const validatedAnswers: QuizAnswers = {
      // Critical fields (no defaults)
      experienceLevel: answers.experienceLevel,
      interests: answers.interests,

      // High-impact fields (defaults provided)
      availability: answers.availability || '5-10h',
      budget: answers.budget || '$0-100',
      timeline: answers.timeline || 'flexible',
      certification: answers.certification || 'not-important',

      // Medium-impact fields (defaults provided)
      learningGoal: answers.learningGoal || 'exploration',
      programming: answers.programming || 'basic',
      mathBackground: answers.mathBackground || 'basic'
    };

    // Track which fields were defaulted for warnings
    const defaultedFields: string[] = [];
    Object.keys(validatedAnswers).forEach(key => {
      if (key !== 'experienceLevel' && key !== 'interests' && !answers[key as keyof QuizAnswers]) {
        defaultedFields.push(key);
      }
    });

    console.log(`[${correlationId}] Processing quiz for user ${userId}`);
    if (defaultedFields.length > 0) {
      console.log(`[${correlationId}] Defaulted fields: ${defaultedFields.join(', ')}`);
    }

    // Check cache (optional - gracefully skip if Redis not available)
    const cacheKey = `quiz:result:${userId}:${hashQuizAnswers(validatedAnswers)}`;
    let cached: QuizSubmissionResponse | null = null;

    try {
      cached = await cacheGet<QuizSubmissionResponse>(cacheKey);
    } catch (error) {
      console.log(`[${correlationId}] Cache unavailable (skipping):`,
        error instanceof Error ? error.message : 'Unknown error');
    }

    if (cached) {
      console.log(`[${correlationId}] Cache hit`);
      res.json({
        ...cached,
        fromCache: true,
        processingTimeMs: Date.now() - startTime
      });
      return;
    }

    console.log(`[${correlationId}] Cache miss, processing...`);

    // Check if agents are available
    const useAgents = !!process.env.PROFILE_ANALYZER_URL;

    let result: QuizSubmissionResponse;

    if (useAgents) {
      // Multi-agent orchestration
      result = await orchestrateAgents(userId, validatedAnswers, correlationId);
    } else {
      // Local processing (fallback for testing without agents deployed)
      console.log(`[${correlationId}] Using local processing (agents not configured)`);
      result = await localScoreQuiz(userId, validatedAnswers);
    }

    // Add warnings for defaulted fields
    const warnings = generateWarnings(defaultedFields, validatedAnswers);
    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    // Cache results (1 hour TTL) - gracefully skip if Redis not available
    try {
      await cacheSet(cacheKey, result, 3600, 'v1');
      console.log(`[${correlationId}] Result cached successfully`);
    } catch (error) {
      console.log(`[${correlationId}] Cache unavailable (skipping):`,
        error instanceof Error ? error.message : 'Unknown error');
    }

    // Add processing metadata
    const processingTimeMs = Date.now() - startTime;
    console.log(`[${correlationId}] Quiz scored in ${processingTimeMs}ms`);

    res.json({
      ...result,
      processingTimeMs,
      correlationId
    });

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Failed to score quiz',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
}

/**
 * Orchestrate multi-agent workflow
 */
async function orchestrateAgents(
  userId: number,
  answers: QuizAnswers,
  correlationId: string
): Promise<QuizSubmissionResponse> {
  console.log(`[${correlationId}] Starting multi-agent orchestration`);

  // Step 1: Fetch learning paths and courses from database
  console.log(`[${correlationId}] Fetching learning paths...`);
  const learningPaths = await fetchActiveLearningPaths();
  const pathIds = learningPaths.map(p => p.id);
  const coursesByPath = await fetchCoursesForPaths(pathIds);

  console.log(`[${correlationId}] Loaded ${learningPaths.length} paths, ${coursesByPath.size} course sets`);

  // Step 2: Parallel agent invocation (Profile Analyzer + Content Matcher)
  console.log(`[${correlationId}] Invoking profile analyzer and content matcher in parallel...`);

  const [profileResult, contentResult] = await Promise.all([
    // Profile Analyzer: parse quiz answers into user profile
    invokeAgent<{ answers: QuizAnswers; userId: number }, ProfileAnalyzerResult>(
      'profile-analyzer',
      { answers, userId },
      correlationId,
      'orchestrator'
    ),

    // Content Matcher: build TF-IDF corpus and calculate content scores
    invokeAgent<{ userProfile: any; learningPaths: any[] }, ContentMatcherResult>(
      'content-matcher',
      {
        userProfile: { interests: answers.interests }, // Minimal profile for content matching
        learningPaths: learningPaths.map(p => ({
          id: p.document_id,
          title: p.title,
          description: p.description,
          topics: p.topics || []
        }))
      },
      correlationId,
      'orchestrator'
    )
  ]);

  console.log(`[${correlationId}] Profile and content analysis complete`);

  // Step 3: Sequential optimization (Path Optimizer)
  console.log(`[${correlationId}] Invoking path optimizer...`);

  const optimizerResult = await invokeAgent<any, PathOptimizerResult>(
    'path-optimizer',
    {
      userProfile: profileResult.userProfile,
      contentScores: contentResult.contentScores,
      learningPaths,
      courses: Object.fromEntries(coursesByPath)
    },
    correlationId,
    'orchestrator'
  );

  console.log(`[${correlationId}] Path optimization complete, ${optimizerResult.rankedPaths.length} paths ranked`);

  // Step 4: Build final recommendations
  console.log(`[${correlationId}] Building recommendations...`);

  const recommendationsResult = await invokeAgent<any, RecommendationBuilderResult>(
    'recommendation-builder',
    {
      rankedPaths: optimizerResult.rankedPaths,
      userProfile: profileResult.userProfile,
      topN: 5
    },
    correlationId,
    'orchestrator'
  );

  // Step 4.5: Enrich top paths with Gemini AI (optional enhancement)
  console.log(`[${correlationId}] Enriching paths with Gemini AI...`);

  let enrichedPaths = optimizerResult.rankedPaths;

  try {
    // Extract user context from profile and answers
    const userInterests = answers.interests || [];
    const userGoals = answers.learningGoal || 'General learning';

    // Enrich top 3 paths with AI insights (cost optimization)
    enrichedPaths = await enrichPathsWithGemini(
      optimizerResult.rankedPaths,
      userInterests,
      userGoals,
      3 // Only enrich top 3 paths
    );

    console.log(`[${correlationId}] Gemini enrichment successful`);
  } catch (error) {
    console.log(`[${correlationId}] Gemini enrichment failed (using fallback):`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    // Continue with non-enriched paths (graceful degradation)
  }

  // Step 5: Save to database
  console.log(`[${correlationId}] Saving to database...`);

  const submissionId = await saveQuizSubmission(
    userId,
    answers,
    profileResult.categoryScores
  );

  await saveQuizRecommendations(
    submissionId,
    enrichedPaths.slice(0, 5).map((rec, i) => ({
      pathId: rec.pathId,
      matchScore: rec.matchScore,
      matchReasons: rec.matchReasons,
      confidence: rec.confidence,
      rank: i + 1,
      categoryBreakdown: rec.categoryBreakdown
    }))
  );

  // Update user profile (optional - gracefully skip if schema mismatch)
  try {
    await updateUserProfile(userId, {
      learningGoals: answers.learningGoal,
      experienceLevel: answers.experienceLevel,
      availabilityHours: parseAvailabilityHours(answers.availability),
      budgetRange: parseBudgetRange(answers.budget)
      // Removed: learningStyle and industry (fields no longer in quiz)
    });
    console.log(`[${correlationId}] User profile updated`);
  } catch (error) {
    console.log(`[${correlationId}] User profile update skipped (schema mismatch):`,
      error instanceof Error ? error.message : 'Unknown error');
  }

  console.log(`[${correlationId}] Database save complete`);

  // Return response
  return {
    submissionId,
    recommendations: enrichedPaths.slice(0, 5),
    categoryScores: profileResult.categoryScores,
    processingTimeMs: 0, // Will be set by handler
    correlationId
  };
}

/**
 * Generate warnings for defaulted/missing fields
 */
function generateWarnings(defaultedFields: string[], validatedAnswers: QuizAnswers): string[] {
  const warnings: string[] = [];

  // High-impact field warnings (affect recommendations significantly)
  if (defaultedFields.includes('availability')) {
    warnings.push('Time commitment not specified - defaulted to 5-10 hours/week. Recommendations may not fit your actual schedule.');
  }
  if (defaultedFields.includes('budget')) {
    warnings.push('Budget not specified - defaulted to $0-100. Some recommended paths may exceed your actual budget.');
  }
  if (defaultedFields.includes('timeline')) {
    warnings.push('Timeline not specified - defaulted to flexible. Recommendations may include longer paths than you need.');
  }

  // Medium-impact field warnings
  if (defaultedFields.includes('certification')) {
    warnings.push('Certification preference not specified - showing all paths regardless of certification availability.');
  }
  if (defaultedFields.includes('learningGoal')) {
    warnings.push('Learning goal not specified - recommendations may not be optimized for your specific objective.');
  }

  // Info warnings (less critical)
  if (defaultedFields.includes('programming') || defaultedFields.includes('mathBackground')) {
    warnings.push('Background information not fully specified - recommendations based on experience level only.');
  }

  // General warning if many fields defaulted
  if (defaultedFields.length >= 4) {
    warnings.push(`Recommendations based on limited information (${9 - defaultedFields.length}/9 questions answered). For more personalized results, complete your profile.`);
  }

  return warnings;
}

/**
 * Helper functions
 */
function parseAvailabilityHours(avail: string): number {
  const map: Record<string, number> = {
    '0-5h': 3,
    '5-10h': 7,
    '10-20h': 15,
    '20+h': 25
  };
  return map[avail] || 10;
}

function parseBudgetRange(budget: string): { min: number; max: number } {
  const map: Record<string, { min: number; max: number }> = {
    '$0': { min: 0, max: 0 },
    '$0-100': { min: 0, max: 100 },
    '$100-500': { min: 100, max: 500 },
    '$500+': { min: 500, max: 10000 }
  };
  return map[budget] || { min: 0, max: 100 };
}
