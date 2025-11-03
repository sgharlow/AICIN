/**
 * 2-Layer Scoring System (Optimized for 251 Learning Paths)
 * Layer 1: Metadata (difficulty, budget, timeline) - 70% weight (PRIMARY DIFFERENTIATOR)
 * Layer 2: Content (TF-IDF) - 30% weight (SEMANTIC MATCHING)
 *
 * Note: Metadata provides better differentiation than TF-IDF with small corpus.
 * Content matching supplements with semantic similarity.
 */

import type {
  UserProfile,
  LearningPath,
  Course,
  LayerWeights,
  LayerScores,
  ValidationScores,
  PathMatchResult,
  MatchReason
} from '@aicin/types';

/**
 * Calculate adaptive layer weights based on data completeness
 * 2-Layer System: Metadata (70%) + Content (30%)
 *
 * REVERSED WEIGHTS: Metadata is now primary because:
 * - TF-IDF doesn't differentiate well with 251 paths
 * - Metadata (experience, budget, timeline) provides clear differentiation
 * - Content matching supplements with semantic similarity
 *
 * UPDATED: Fixed 70/30 weights regardless of completeness_score
 * - Database has completeness_score = 0 for ALL paths (not populated)
 * - But metadata (difficulty, cost, duration) IS populated
 * - So we use metadata-first scoring always
 */
export function calculateAdaptiveWeights(path: LearningPath): LayerWeights {
  // Database diagnostics show:
  // - completeness_score = 0 for ALL 251 paths (field not populated)
  // - BUT metadata (difficulty, total_cost, total_realistic_hours) IS populated
  // - Therefore: Use fixed metadata-first weights (70/30)
  //
  // This ensures beginners don't get advanced paths due to high content scores
  return {
    content: 0.30,  // Content supplements with semantic matching
    metadata: 0.70, // Metadata is primary (experience level, budget, timeline)
    courses: 0.00   // Not used (kept for type compatibility)
  };
}

/**
 * Layer 1: Content score (from TF-IDF)
 * Already calculated by Content Matcher agent
 */
export function getContentScore(pathId: string, contentScores: Map<string, number>): number {
  const score = contentScores.get(pathId) || 0;

  // Debug logging for ID mismatch investigation
  if (score === 0 && contentScores.size > 0) {
    console.log(`[DEBUG] Content score lookup: pathId="${pathId}", found=${contentScores.has(pathId)}, score=${score}`);
    // Log first 3 keys in contentScores for comparison
    const keys = Array.from(contentScores.keys()).slice(0, 3);
    console.log(`[DEBUG] Sample contentScores keys: ${keys.join(', ')}`);
  }

  // Normalize to 0-1 range (TF-IDF scores typically 0-2)
  return Math.min(score, 1.0);
}

/**
 * Layer 2: Metadata score
 * Considers difficulty, budget, timeline, certification
 *
 * UPDATED: Increased experience level weight from 0.3 to 0.5
 * - Experience level is now the DOMINANT factor (50% of metadata)
 * - Budget reduced from 0.25 to 0.2 (20%)
 * - Timeline reduced from 0.25 to 0.2 (20%)
 * - Certification reduced from 0.2 to 0.1 (10%)
 *
 * This ensures beginners don't get advanced paths even if budget/timeline match
 */
export function calculateMetadataScore(path: LearningPath, userProfile: UserProfile): number {
  let score = 0;
  let maxScore = 0;

  // Experience level matching (0.5 weight) - DOMINANT FACTOR
  // With stricter level matching (0.05 for 2+ level mismatch), this prevents
  // beginners from getting advanced paths even if other metadata matches
  if (path.level) {
    maxScore += 0.5;
    const levelScore = matchExperienceLevel(userProfile.experienceLevel, path.level);
    score += levelScore * 0.5;
  }

  // Budget matching (0.2 weight)
  if (path.total_cost !== null && path.total_cost !== undefined) {
    maxScore += 0.2;
    const budgetScore = path.total_cost <= userProfile.maxBudget ? 1.0 :
      Math.max(0, 1 - (path.total_cost - userProfile.maxBudget) / userProfile.maxBudget);
    score += budgetScore * 0.2;
  }

  // Timeline matching (0.2 weight)
  if (path.estimated_hours) {
    maxScore += 0.2;
    const weeksNeeded = path.estimated_hours / userProfile.weeklyHours;
    const timelineScore = weeksNeeded <= userProfile.timeline ? 1.0 :
      Math.max(0, 1 - (weeksNeeded - userProfile.timeline) / userProfile.timeline);
    score += timelineScore * 0.2;
  }

  // Certification matching (0.1 weight)
  if (path.has_certificate !== null && path.has_certificate !== undefined) {
    maxScore += 0.1;
    const wantsCert = userProfile.wantsCertification;
    const hasCert = path.has_certificate;
    const certScore = (wantsCert && hasCert) ? 1.0 : (wantsCert && !hasCert) ? 0.3 : 0.7;
    score += certScore * 0.1;
  }

  // Normalize by available metadata
  return maxScore > 0 ? score / maxScore : 0.5;
}

/**
 * Layer 3: Course quality score
 * Aggregates course ratings, quality scores, provider diversity
 */
export function calculateCourseScore(courses: Course[]): number {
  if (courses.length === 0) {
    return 0.5; // Neutral score if no courses
  }

  // Average quality score (0-1)
  const validQualityScores = courses.filter(c => c.quality_score !== null && c.quality_score !== undefined);
  const avgQuality = validQualityScores.length > 0
    ? validQualityScores.reduce((sum, c) => sum + (c.quality_score || 0), 0) / validQualityScores.length
    : 0.5;

  // Average rating (0-1, normalized from 0-5 scale)
  const validRatings = courses.filter(c => c.rating !== null && c.rating !== undefined);
  const avgRating = validRatings.length > 0
    ? (validRatings.reduce((sum, c) => sum + (c.rating || 0), 0) / validRatings.length) / 5
    : 0.5;

  // Provider diversity (0-1)
  const providers = new Set(courses.map(c => c.provider_name));
  const diversity = Math.min(providers.size / courses.length * 2, 1.0);

  // Weighted combination: quality 50%, rating 35%, diversity 15%
  return avgQuality * 0.5 + avgRating * 0.35 + diversity * 0.15;
}

/**
 * Score a learning path using 3-layer system with adaptive weights
 */
export function scorePath(
  path: LearningPath,
  courses: Course[],
  userProfile: UserProfile,
  contentScores: Map<string, number>
): {
  matchScore: number;
  confidence: 'low' | 'medium' | 'high';
  layerBreakdown: LayerScores;
  weights: LayerWeights;
} {
  // Calculate adaptive weights (2-layer system)
  const weights = calculateAdaptiveWeights(path);

  // Calculate layer scores (2-layer: content + metadata only)
  const contentScore = getContentScore(path.document_id, contentScores);
  const metadataScore = calculateMetadataScore(path, userProfile);
  const courseScore = 0; // Not used in 2-layer system (all paths are pre-validated for quality)

  // Compute weighted final score
  const totalWeight = weights.content + weights.metadata + weights.courses;
  const normalizedWeights = {
    content: weights.content / totalWeight,
    metadata: weights.metadata / totalWeight,
    courses: weights.courses / totalWeight,
  };

  const rawScore =
    contentScore * normalizedWeights.content +
    metadataScore * normalizedWeights.metadata +
    courseScore * normalizedWeights.courses;

  // Determine confidence level
  const completenessScore = path.completeness_score || 50;
  const confidence = determineConfidence(rawScore, completenessScore);

  // Apply confidence penalty
  const penaltyMap: Record<string, number> = {
    'high': 1.0,
    'medium': 0.95,
    'low': 0.85,
  };
  const sparsityPenalty = completenessScore < 30 ? 0.90 : 1.0;
  const finalScore = rawScore * penaltyMap[confidence] * sparsityPenalty;

  return {
    matchScore: Math.round(finalScore * 100) / 100,
    confidence,
    layerBreakdown: {
      content: contentScore,
      metadata: metadataScore,
      courses: courseScore
    },
    weights
  };
}

/**
 * Generate match reasons for explainability
 */
export function generateMatchReasons(
  path: LearningPath,
  userProfile: UserProfile,
  layerBreakdown: LayerScores
): MatchReason[] {
  const reasons: MatchReason[] = [];

  // Content-based reasons
  if (layerBreakdown.content >= 0.7) {
    const pathTopics = path.topics || [];
    const matchedInterests = userProfile.interests.filter(interest =>
      pathTopics.some(topic =>
        topic.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(topic.toLowerCase())
      )
    );

    if (matchedInterests.length > 0) {
      reasons.push({
        reason: `Covers ${matchedInterests.length}/${userProfile.interests.length} of your interests: ${matchedInterests.join(', ')}`,
        weight: 0.40,
        category: 'content',
        evidence: `Topics: ${pathTopics.slice(0, 3).join(', ')}`
      });
    } else {
      reasons.push({
        reason: 'Strong content match with your learning goals',
        weight: 0.40,
        category: 'content'
      });
    }
  }

  // Metadata-based reasons
  if (layerBreakdown.metadata >= 0.7) {
    if (path.level === userProfile.experienceLevel) {
      reasons.push({
        reason: `Perfect match for your ${userProfile.experienceLevel} level`,
        weight: 0.35,
        category: 'metadata'
      });
    }

    if (path.total_cost && path.total_cost <= userProfile.maxBudget) {
      reasons.push({
        reason: `Fits your budget ($${path.total_cost} total cost)`,
        weight: 0.25,
        category: 'metadata'
      });
    }

    if (path.estimated_hours) {
      const weeksNeeded = Math.ceil(path.estimated_hours / userProfile.weeklyHours);
      if (weeksNeeded <= userProfile.timeline) {
        reasons.push({
          reason: `Achievable in ${weeksNeeded} weeks with your ${userProfile.weeklyHours}h/week commitment`,
          weight: 0.25,
          category: 'metadata'
        });
      }
    }
  }

  // Course quality reasons
  if (layerBreakdown.courses >= 0.7) {
    reasons.push({
      reason: 'High-quality courses from trusted providers',
      weight: 0.25,
      category: 'courses'
    });
  }

  // Learning goal specific reasons
  if (userProfile.learningGoal === 'career-switch' && path.level === 'beginner') {
    reasons.push({
      reason: 'Perfect for career changers with structured progression',
      weight: 0.15,
      category: 'goals'
    });
  } else if (userProfile.learningGoal === 'upskill' && path.level === 'advanced') {
    reasons.push({
      reason: 'Designed for experienced developers seeking to upskill',
      weight: 0.15,
      category: 'goals'
    });
  }

  // Sort by weight descending and return top 5
  return reasons.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

/**
 * Determine confidence level
 * Score-based only (ignoring completeness)
 *
 * With metadata-focused scoring (70% metadata, 30% content), scores should
 * be well-distributed based on user requirements match.
 */
function determineConfidence(
  score: number,
  completenessScore: number
): 'low' | 'medium' | 'high' {
  // High confidence: strong match on both metadata and content
  // Top-tier recommendations that meet user requirements well
  if (score >= 0.6) {
    return 'high';
  }

  // Medium confidence: good match, reasonable fit
  // Solid recommendations that address most user needs
  if (score >= 0.35) {
    return 'medium';
  }

  // Low confidence: weak match or poor fit
  // Fallback recommendations or misaligned requirements
  return 'low';
}

/**
 * Match experience level
 *
 * UPDATED: Stricter level matching to prevent beginners getting advanced paths
 * - Perfect match (0 levels apart): 1.0
 * - 1 level apart: 0.4 (acceptable stretch, e.g., beginner → intermediate)
 * - 2+ levels apart: 0.05 (strong penalty, e.g., beginner → advanced)
 *
 * FIXED: Handle case-insensitive matching and special values
 * - Database has "Beginner", "Intermediate", "Advanced", "Complete Journey"
 * - Code expects lowercase: "beginner", "intermediate", "advanced"
 * - "Complete Journey" treated as intermediate level
 */
function matchExperienceLevel(
  userLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert',
  pathLevel: 'beginner' | 'intermediate' | 'advanced' | string
): number {
  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];

  // Normalize user level to lowercase
  const normalizedUserLevel = userLevel.toLowerCase();
  const userIndex = levelOrder.indexOf(normalizedUserLevel);

  // Normalize path level to lowercase and handle special cases
  let normalizedPathLevel = pathLevel.toLowerCase().trim();

  // Map special values
  if (normalizedPathLevel.includes('complete') || normalizedPathLevel.includes('journey')) {
    // "Complete Journey" paths are comprehensive, treat as intermediate
    normalizedPathLevel = 'intermediate';
  }

  const pathIndex = levelOrder.indexOf(normalizedPathLevel);

  // Handle unknown levels - default to intermediate (neutral penalty)
  if (userIndex === -1) {
    console.warn(`[matchExperienceLevel] Unknown user level: "${userLevel}"`);
    return 0.5;
  }
  if (pathIndex === -1) {
    console.warn(`[matchExperienceLevel] Unknown path level: "${pathLevel}" (normalized: "${normalizedPathLevel}")`);
    // Unknown path level: assume intermediate, calculate penalty
    const intermediateIndex = 1; // 'intermediate'
    const difference = Math.abs(userIndex - intermediateIndex);
    if (difference === 0) return 1.0;
    if (difference === 1) return 0.4;
    return 0.05;
  }

  const difference = Math.abs(userIndex - pathIndex);

  // Stricter penalty:
  // - 0 levels apart: 1.0 (perfect match)
  // - 1 level apart: 0.4 (acceptable, one step up or down)
  // - 2+ levels apart: 0.05 (nearly incompatible)
  if (difference === 0) return 1.0;
  if (difference === 1) return 0.4;
  return 0.05; // Strong penalty for 2+ level mismatch
}
