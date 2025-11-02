/**
 * 3-Layer Scoring System
 * Layer 1: Content (TF-IDF) - 40% weight
 * Layer 2: Metadata (difficulty, budget, timeline) - 35% weight
 * Layer 3: Course Quality - 25% weight
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
 */
export function calculateAdaptiveWeights(path: LearningPath): LayerWeights {
  const completenessScore = path.completeness_score || 50;

  // If data is sparse (< 50% complete), rely more on content matching
  if (completenessScore < 50) {
    return {
      content: 0.50,  // Increase content weight
      metadata: 0.25, // Decrease metadata weight
      courses: 0.25
    };
  }

  // If data is rich (>= 80% complete), use balanced weights
  if (completenessScore >= 80) {
    return {
      content: 0.35,  // Decrease content weight
      metadata: 0.40, // Increase metadata weight
      courses: 0.25
    };
  }

  // Default balanced weights (50-80% complete)
  return {
    content: 0.40,
    metadata: 0.35,
    courses: 0.25
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
 */
export function calculateMetadataScore(path: LearningPath, userProfile: UserProfile): number {
  let score = 0;
  let maxScore = 0;

  // Experience level matching (0.3 weight)
  if (path.level) {
    maxScore += 0.3;
    const levelScore = matchExperienceLevel(userProfile.experienceLevel, path.level);
    score += levelScore * 0.3;
  }

  // Budget matching (0.25 weight)
  if (path.total_cost !== null && path.total_cost !== undefined) {
    maxScore += 0.25;
    const budgetScore = path.total_cost <= userProfile.maxBudget ? 1.0 :
      Math.max(0, 1 - (path.total_cost - userProfile.maxBudget) / userProfile.maxBudget);
    score += budgetScore * 0.25;
  }

  // Timeline matching (0.25 weight)
  if (path.estimated_hours) {
    maxScore += 0.25;
    const weeksNeeded = path.estimated_hours / userProfile.weeklyHours;
    const timelineScore = weeksNeeded <= userProfile.timeline ? 1.0 :
      Math.max(0, 1 - (weeksNeeded - userProfile.timeline) / userProfile.timeline);
    score += timelineScore * 0.25;
  }

  // Certification matching (0.2 weight)
  if (path.has_certificate !== null && path.has_certificate !== undefined) {
    maxScore += 0.2;
    const wantsCert = userProfile.wantsCertification;
    const hasCert = path.has_certificate;
    const certScore = (wantsCert && hasCert) ? 1.0 : (wantsCert && !hasCert) ? 0.3 : 0.7;
    score += certScore * 0.2;
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
  // Calculate adaptive weights
  const weights = calculateAdaptiveWeights(path);

  // Calculate layer scores
  const contentScore = getContentScore(path.document_id, contentScores);
  const metadataScore = calculateMetadataScore(path, userProfile);
  const courseScore = calculateCourseScore(courses);

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
 */
function determineConfidence(
  score: number,
  completenessScore: number
): 'low' | 'medium' | 'high' {
  if (score >= 0.8 && completenessScore >= 80) {
    return 'high';
  }
  if (score >= 0.6 && completenessScore >= 50) {
    return 'medium';
  }
  return 'low';
}

/**
 * Match experience level
 */
function matchExperienceLevel(
  userLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert',
  pathLevel: 'beginner' | 'intermediate' | 'advanced'
): number {
  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const userIndex = levelOrder.indexOf(userLevel);
  const pathIndex = levelOrder.indexOf(pathLevel);
  const difference = Math.abs(userIndex - pathIndex);
  return Math.max(0, 1 - difference * 0.3);
}
