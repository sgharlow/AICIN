/**
 * Local Quiz Scorer
 * Fallback implementation when agents are not deployed yet
 * Uses simplified scoring logic from Lambda service
 */

import type { QuizAnswers, QuizSubmissionResponse, PathMatchResult, UserProfile } from '@aicin/types';
import {
  fetchActiveLearningPaths,
  fetchCoursesForPaths,
  saveQuizSubmission,
  saveQuizRecommendations,
  updateUserProfile
} from '@aicin/database';

/**
 * Local quiz scoring (simplified from Lambda service)
 * Used as fallback when agents are not yet deployed
 */
export async function localScoreQuiz(
  userId: number,
  answers: QuizAnswers
): Promise<QuizSubmissionResponse> {
  console.log(`[LocalScorer] Processing quiz for user ${userId}`);

  // Convert to user profile
  const userProfile = convertToUserProfile(answers);

  // Calculate category scores (legacy format)
  const categoryScores = calculateCategoryScores(answers);

  // Fetch all active learning paths
  const learningPaths = await fetchActiveLearningPaths();
  console.log(`[LocalScorer] Evaluating ${learningPaths.length} paths`);

  // Calculate match score for each path
  const pathMatches: PathMatchResult[] = [];

  for (const path of learningPaths) {
    const match = calculatePathMatch(path as any, answers, categoryScores);

    pathMatches.push({
      pathId: path.id,
      pathTitle: path.title,
      pathSlug: path.slug,
      matchScore: match.matchScore,
      confidence: match.confidence,
      matchReasons: match.matchReasons,
      categoryBreakdown: match.categoryBreakdown
    });
  }

  // Sort by match score
  pathMatches.sort((a, b) => b.matchScore - a.matchScore);

  // Take top 5
  const topRecommendations = pathMatches.slice(0, 5);

  // Save to database
  const submissionId = await saveQuizSubmission(userId, answers, categoryScores);

  await saveQuizRecommendations(
    submissionId,
    topRecommendations.map((rec, i) => ({
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
      availabilityHours: parseAvailability(answers.availability),
      budgetRange: parseBudget(answers.budget),
      learningStyle: answers.learningStyle,
      industry: answers.industry
    });
    console.log(`[LocalScorer] User profile updated`);
  } catch (error) {
    console.log(`[LocalScorer] User profile update skipped (schema mismatch):`,
      error instanceof Error ? error.message : 'Unknown error');
  }

  console.log(`[LocalScorer] Processing complete`);

  return {
    submissionId,
    recommendations: topRecommendations,
    categoryScores,
    processingTimeMs: 0,
    correlationId: ''
  };
}

// Helper functions from Lambda service
function convertToUserProfile(answers: QuizAnswers): UserProfile {
  const maxBudget = parseBudget(answers.budget).max;
  const weeklyHours = parseAvailability(answers.availability);
  const timeline = parseTimeline(answers.timeline);

  return {
    interests: answers.interests,
    experienceLevel: answers.experienceLevel,
    learningGoal: answers.learningGoal,
    programmingExperience: answers.programming as any,
    mathBackground: answers.mathBackground as any,
    maxBudget,
    weeklyHours,
    timeline,
    preferredFormat: answers.learningStyle,
    wantsCertification: answers.certification === 'required'
  };
}

function calculateCategoryScores(answers: QuizAnswers): Record<string, number> {
  return {
    experience: scoreExperience(answers.experienceLevel),
    goals: scoreGoals(answers.learningGoal),
    timeline: scoreTimeline(answers.timeline),
    budget: scoreBudget(answers.budget),
    background: scoreBackground(answers.background),
    programming: scoreProgramming(answers.programming),
    certification: scoreCertification(answers.certification)
  };
}

function calculatePathMatch(
  path: any,
  answers: QuizAnswers,
  categoryScores: Record<string, number>
): { matchScore: number; confidence: 'low' | 'medium' | 'high'; matchReasons: any[]; categoryBreakdown: any } {
  const weights = {
    experience: 0.20,
    goals: 0.15,
    timeline: 0.15,
    budget: 0.12,
    background: 0.10,
    interests: 0.08,
    programming: 0.08,
    certification: 0.03
  };

  let totalScore = 0;
  const categoryBreakdown: Record<string, number> = {};
  const matchReasons: any[] = [];

  // Experience matching
  const experienceMatch = matchExperienceLevel(answers.experienceLevel, path.level || 'beginner');
  totalScore += experienceMatch * weights.experience;
  categoryBreakdown.experience = experienceMatch;

  if (experienceMatch > 0.7) {
    matchReasons.push({
      reason: `Path difficulty matches your ${answers.experienceLevel} level`,
      weight: weights.experience,
      category: 'experience'
    });
  }

  // Budget matching
  const budgetMatch = matchBudget(answers.budget, path);
  totalScore += budgetMatch * weights.budget;
  categoryBreakdown.budget = budgetMatch;

  if (budgetMatch > 0.7) {
    matchReasons.push({
      reason: 'Within your budget range',
      weight: weights.budget,
      category: 'budget'
    });
  }

  // Interests matching
  const interestsMatch = matchInterests(answers.interests, path);
  totalScore += interestsMatch * weights.interests;
  categoryBreakdown.interests = interestsMatch;

  const confidence = determineConfidence(totalScore, matchReasons.length);

  return {
    matchScore: Math.round(totalScore * 100) / 100,
    confidence,
    matchReasons: matchReasons.slice(0, 3),
    categoryBreakdown
  };
}

// Scoring functions
function scoreExperience(level: string): number {
  const map: Record<string, number> = { beginner: 0.25, intermediate: 0.50, advanced: 0.75, expert: 1.0 };
  return map[level] || 0.5;
}

function scoreGoals(goal: string): number {
  const map: Record<string, number> = { 'career-switch': 1.0, upskill: 0.8, exploration: 0.5, certification: 0.9 };
  return map[goal] || 0.7;
}

function scoreTimeline(timeline: string): number {
  const map: Record<string, number> = { flexible: 0.5, '3-6-months': 0.7, '1-3-months': 0.9, asap: 1.0 };
  return map[timeline] || 0.6;
}

function scoreBudget(budget: string): number {
  const map: Record<string, number> = { '$0': 0.3, '$0-100': 0.6, '$100-500': 0.8, '$500+': 1.0 };
  return map[budget] || 0.5;
}

function scoreBackground(background: string): number {
  const map: Record<string, number> = { tech: 1.0, 'non-tech': 0.6, student: 0.7, other: 0.5 };
  return map[background] || 0.6;
}

function scoreProgramming(programming: string): number {
  const map: Record<string, number> = { none: 0.2, basic: 0.5, intermediate: 0.75, advanced: 1.0 };
  return map[programming] || 0.5;
}

function scoreCertification(cert: string): number {
  const map: Record<string, number> = { 'not-important': 0.3, 'nice-to-have': 0.6, required: 1.0 };
  return map[cert] || 0.5;
}

// Matching functions
function matchExperienceLevel(userLevel: string, pathLevel: string): number {
  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const userIndex = levelOrder.indexOf(userLevel);
  const pathIndex = levelOrder.indexOf(pathLevel);
  const difference = Math.abs(userIndex - pathIndex);
  return Math.max(0, 1 - difference * 0.3);
}

function matchBudget(budget: string, path: any): number {
  const pathCost = path.total_cost || 0;
  const budgetMax: Record<string, number> = { '$0': 0, '$0-100': 100, '$100-500': 500, '$500+': 10000 };
  const userMax = budgetMax[budget] || 0;
  return pathCost <= userMax ? 1.0 : Math.max(0, 1 - (pathCost - userMax) / userMax);
}

function matchInterests(interests: string[], path: any): number {
  const pathTopics = (path.topics || []).map((t: string) => t.toLowerCase());
  const userInterests = interests.map((i: string) => i.toLowerCase());
  const matches = userInterests.filter((i: string) =>
    pathTopics.some((t: string) => t.includes(i) || i.includes(t))
  );
  return matches.length / Math.max(userInterests.length, 1);
}

function determineConfidence(score: number, reasonCount: number): 'low' | 'medium' | 'high' {
  if (score >= 0.8 && reasonCount >= 3) return 'high';
  if (score >= 0.6 && reasonCount >= 2) return 'medium';
  return 'low';
}

function parseAvailability(avail: string): number {
  const map: Record<string, number> = { '0-5h': 3, '5-10h': 7, '10-20h': 15, '20+h': 25 };
  return map[avail] || 10;
}

function parseBudget(budget: string): { min: number; max: number } {
  const map: Record<string, { min: number; max: number }> = {
    '$0': { min: 0, max: 0 },
    '$0-100': { min: 0, max: 100 },
    '$100-500': { min: 100, max: 500 },
    '$500+': { min: 500, max: 10000 }
  };
  return map[budget] || { min: 0, max: 100 };
}

function parseTimeline(timeline: string): number {
  const map: Record<string, number> = { flexible: 52, '3-6-months': 20, '1-3-months': 8, asap: 4 };
  return map[timeline] || 26;
}
