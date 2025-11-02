/**
 * AICIN Course Validator Agent
 * Validates course quality and alignment with user profile
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type {
  AgentMessage,
  CourseValidatorPayload,
  CourseValidatorResult,
  ValidationScores,
  UserProfile,
  Course,
  MismatchedCourse
} from '@aicin/types';
import { generateCorrelationId } from '@aicin/utils';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8084');

app.use(cors());
app.use(express.json());

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
    agent: 'course-validator',
    timestamp: new Date().toISOString()
  });
});

// Agent invocation endpoint
app.post('/invoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    const message = req.body as AgentMessage<CourseValidatorPayload>;
    const { userProfile, courses } = message.payload;

    console.log(`[${correlationId}] Validating ${courses.length} courses`);

    // Calculate validation scores
    const validationScores = calculateValidation(userProfile, courses);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[${correlationId}] Validation complete in ${processingTimeMs}ms`);
    console.log(`[${correlationId}] Overall validation: ${validationScores.overall_validation.toFixed(2)}, Pass: ${validationScores.validation_pass}`);

    const result: CourseValidatorResult = {
      validationScores,
      recommendations: generateRecommendations(validationScores)
    };

    res.json(result);

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Course validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[CourseValidator] SIGTERM received, shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[CourseValidator] Server listening on port ${PORT}`);
});

export default app;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Calculate overall validation scores
 */
function calculateValidation(userProfile: UserProfile, courses: Course[]): ValidationScores {
  const mismatched: MismatchedCourse[] = [];

  // 1. Difficulty fit
  const difficultyFit = calculateDifficultyFit(userProfile, courses, mismatched);

  // 2. Topic coverage
  const topicCoverage = calculateTopicCoverage(userProfile, courses);

  // 3. Time alignment
  const timeAlignment = calculateTimeAlignment(userProfile, courses);

  // 4. Budget fit
  const budgetFit = calculateBudgetFit(userProfile, courses);

  // 5. Format match
  const formatMatch = calculateFormatMatch(userProfile, courses);

  // 6. Prerequisite match
  const prerequisiteMatch = calculatePrerequisiteMatch(userProfile, courses);

  // Overall validation (average of all scores)
  const overallValidation = (
    difficultyFit + topicCoverage + timeAlignment +
    budgetFit + formatMatch + prerequisiteMatch
  ) / 6;

  // Pass threshold: 0.6
  const validationPass = overallValidation >= 0.6;

  return {
    difficulty_fit: Math.round(difficultyFit * 100) / 100,
    topic_coverage: Math.round(topicCoverage * 100) / 100,
    time_alignment: Math.round(timeAlignment * 100) / 100,
    budget_fit: Math.round(budgetFit * 100) / 100,
    format_match: Math.round(formatMatch * 100) / 100,
    prerequisite_match: Math.round(prerequisiteMatch * 100) / 100,
    overall_validation: Math.round(overallValidation * 100) / 100,
    validation_pass: validationPass,
    validated_courses: courses.length,
    mismatched_courses: mismatched
  };
}

/**
 * 1. Difficulty fit: Do course difficulties match user's experience level?
 */
function calculateDifficultyFit(
  userProfile: UserProfile,
  courses: Course[],
  mismatched: MismatchedCourse[]
): number {
  if (courses.length === 0) return 0.5;

  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const userIndex = levelOrder.indexOf(userProfile.experienceLevel);

  let totalFit = 0;

  courses.forEach(course => {
    const courseIndex = levelOrder.indexOf(course.level);
    const difference = Math.abs(userIndex - courseIndex);

    if (difference > 2) {
      mismatched.push({
        course_id: course.id,
        course_title: course.title,
        reason: `Course difficulty (${course.level}) doesn't match your ${userProfile.experienceLevel} level`
      });
    }

    // Perfect match = 1.0, 1 level off = 0.7, 2 levels = 0.4, 3+ = 0.0
    const fit = Math.max(0, 1 - difference * 0.3);
    totalFit += fit;
  });

  return totalFit / courses.length;
}

/**
 * 2. Topic coverage: Do courses cover user's interests?
 */
function calculateTopicCoverage(userProfile: UserProfile, courses: Course[]): number {
  if (userProfile.interests.length === 0) return 1.0;

  const userInterests = userProfile.interests.map(i => i.toLowerCase());
  const coveredInterests = new Set<string>();

  courses.forEach(course => {
    const courseTopics = (course.topics || []).map(t => t.toLowerCase());

    userInterests.forEach(interest => {
      if (courseTopics.some(topic => topic.includes(interest) || interest.includes(topic))) {
        coveredInterests.add(interest);
      }
    });
  });

  return coveredInterests.size / userInterests.length;
}

/**
 * 3. Time alignment: Can user complete in available time?
 */
function calculateTimeAlignment(userProfile: UserProfile, courses: Course[]): number {
  const totalHours = courses.reduce((sum, c) => sum + (c.duration_hours || 0), 0);

  if (totalHours === 0) return 0.7; // Neutral if no duration info

  const weeksNeeded = totalHours / userProfile.weeklyHours;
  const weeksAvailable = userProfile.timeline;

  if (weeksNeeded <= weeksAvailable) {
    return 1.0;
  }

  // Penalty for exceeding timeline
  return Math.max(0, 1 - (weeksNeeded - weeksAvailable) / weeksAvailable);
}

/**
 * 4. Budget fit: Are courses within budget?
 */
function calculateBudgetFit(userProfile: UserProfile, courses: Course[]): number {
  const totalCost = courses.reduce((sum, c) => sum + (c.price || 0), 0);

  if (totalCost === 0) return 1.0; // Free courses

  if (totalCost <= userProfile.maxBudget) {
    return 1.0;
  }

  // Penalty for exceeding budget
  return Math.max(0, 1 - (totalCost - userProfile.maxBudget) / userProfile.maxBudget);
}

/**
 * 5. Format match: Do courses match preferred learning format?
 */
function calculateFormatMatch(userProfile: UserProfile, courses: Course[]): number {
  // Since we don't have format data in courses, return neutral score
  // In production, this would check course.format against userProfile.preferredFormat
  return 0.8;
}

/**
 * 6. Prerequisite match: Does user meet prerequisites?
 */
function calculatePrerequisiteMatch(userProfile: UserProfile, courses: Course[]): number {
  // Check if user's programming and math background match course requirements
  const programmingLevels = ['none', 'basic', 'intermediate', 'advanced', 'expert'];
  const userProgIndex = programmingLevels.indexOf(userProfile.programmingExperience);

  let totalMatch = 0;

  courses.forEach(course => {
    // Assume beginner courses need none/basic, intermediate needs basic/intermediate, advanced needs intermediate+
    let requiredProgIndex = 0;
    if (course.level === 'intermediate') requiredProgIndex = 1;
    if (course.level === 'advanced') requiredProgIndex = 2;

    const match = userProgIndex >= requiredProgIndex ? 1.0 : 0.5;
    totalMatch += match;
  });

  return courses.length > 0 ? totalMatch / courses.length : 1.0;
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(validation: ValidationScores): string[] {
  const recommendations: string[] = [];

  if (validation.difficulty_fit < 0.6) {
    recommendations.push('Some courses may be too difficult or too easy for your level. Consider filtering by difficulty.');
  }

  if (validation.topic_coverage < 0.7) {
    recommendations.push('This path doesn\'t fully cover all your interests. You may want to supplement with additional courses.');
  }

  if (validation.time_alignment < 0.7) {
    recommendations.push('This path may take longer than your available timeline. Consider reducing weekly commitment or choosing a shorter path.');
  }

  if (validation.budget_fit < 0.8) {
    recommendations.push('This path exceeds your budget. Look for courses with free alternatives or audit options.');
  }

  if (validation.prerequisite_match < 0.7) {
    recommendations.push('Some courses may require additional prerequisites. Review course descriptions carefully.');
  }

  if (validation.validation_pass) {
    recommendations.push('This path is well-aligned with your profile and goals.');
  } else {
    recommendations.push('This path has some alignment issues. Review the validation scores before proceeding.');
  }

  return recommendations;
}
