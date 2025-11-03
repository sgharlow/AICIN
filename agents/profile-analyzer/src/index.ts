/**
 * AICIN Profile Analyzer Agent
 * Parses quiz answers and generates user profiles
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type {
  AgentMessage,
  QuizAnswers,
  UserProfile,
  ProfileAnalyzerPayload,
  ProfileAnalyzerResult
} from '@aicin/types';
import { generateCorrelationId, parseBudget, parseAvailability } from '@aicin/utils';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8081');

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
    agent: 'profile-analyzer',
    timestamp: new Date().toISOString()
  });
});

// Agent invocation endpoint
app.post('/invoke', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId as string;

  try {
    const message = req.body as AgentMessage<ProfileAnalyzerPayload>;
    const { answers, userId } = message.payload;

    console.log(`[${correlationId}] Processing profile for user ${userId}`);

    // Convert quiz answers to user profile
    const userProfile = convertToUserProfile(answers);

    // Calculate category scores (for backward compatibility)
    const categoryScores = calculateCategoryScores(answers);

    const processingTimeMs = Date.now() - startTime;

    const result: ProfileAnalyzerResult = {
      userProfile,
      categoryScores
    };

    console.log(`[${correlationId}] Profile analysis complete in ${processingTimeMs}ms`);

    res.json(result);

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Profile analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ProfileAnalyzer] SIGTERM received, shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[ProfileAnalyzer] Server listening on port ${PORT}`);
});

export default app;

// ============================================================================
// Profile Conversion Functions
// ============================================================================

/**
 * Convert QuizAnswers to UserProfile
 */
function convertToUserProfile(answers: QuizAnswers): UserProfile {
  // Parse budget range
  const budgetMap: Record<string, number> = {
    '$0': 0,
    '$0-100': 100,
    '$100-500': 500,
    '$500+': 10000,
  };
  const maxBudget = budgetMap[answers.budget] || 500;

  // Parse weekly hours
  const availMap: Record<string, number> = {
    '0-5h': 3,
    '5-10h': 7,
    '10-20h': 15,
    '20+h': 25,
  };
  const weeklyHours = availMap[answers.availability] || 10;

  // Parse timeline
  const timelineMap: Record<string, number> = {
    'flexible': 52,
    '3-6-months': 20,
    '1-3-months': 8,
    'asap': 4,
  };
  const timeline = timelineMap[answers.timeline] || 26;

  // Convert math background to standard format
  const mathMap: Record<string, 'none' | 'basic' | 'intermediate' | 'advanced'> = {
    'minimal': 'none',
    'basic': 'basic',
    'strong': 'intermediate',
    'advanced': 'advanced'
  };
  const mathBackground = mathMap[answers.mathBackground] || 'basic';

  // Convert programming experience
  const programmingMap: Record<string, 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert'> = {
    'none': 'none',
    'basic': 'basic',
    'intermediate': 'intermediate',
    'advanced': 'advanced'
  };
  const programmingExperience = programmingMap[answers.programming] || 'basic';

  return {
    interests: answers.interests,
    experienceLevel: answers.experienceLevel,
    learningGoal: answers.learningGoal,
    programmingExperience,
    mathBackground,
    maxBudget,
    weeklyHours,
    timeline,
    wantsCertification: answers.certification === 'required'
    // Removed: preferredFormat (learningStyle field no longer in quiz)
  };
}

/**
 * Calculate category scores (backward compatibility with Lambda)
 * Updated for Phase 2: Removed unused fields (background, specialization, priorProjects)
 */
function calculateCategoryScores(answers: QuizAnswers): Record<string, number> {
  return {
    experience: scoreExperience(answers.experienceLevel),
    goals: scoreGoals(answers.learningGoal),
    timeline: scoreTimeline(answers.timeline),
    budget: scoreBudget(answers.budget),
    interests: scoreInterests(answers.interests),
    programming: scoreProgramming(answers.programming),
    certification: scoreCertification(answers.certification),
    availability: scoreAvailability(answers.availability),
    mathBackground: scoreMathBackground(answers.mathBackground),
    // Removed in Phase 2 (unused in recommendations):
    // - background (only for analytics)
    // - specialization (only for analytics)
    // - priorProjects (redundant with experienceLevel)
    // - learningStyle (not used in scoring)
  };
}

// ============================================================================
// Scoring Functions (0-1 scale)
// ============================================================================

function scoreExperience(level: string): number {
  const map: Record<string, number> = {
    beginner: 0.25,
    intermediate: 0.50,
    advanced: 0.75,
    expert: 1.0
  };
  return map[level] || 0.5;
}

function scoreGoals(goal: string): number {
  const map: Record<string, number> = {
    'career-switch': 1.0,
    upskill: 0.8,
    exploration: 0.5,
    certification: 0.9,
  };
  return map[goal] || 0.7;
}

function scoreTimeline(timeline: string): number {
  const map: Record<string, number> = {
    flexible: 0.5,
    '3-6-months': 0.7,
    '1-3-months': 0.9,
    asap: 1.0
  };
  return map[timeline] || 0.6;
}

function scoreBudget(budget: string): number {
  const map: Record<string, number> = {
    '$0': 0.3,
    '$0-100': 0.6,
    '$100-500': 0.8,
    '$500+': 1.0
  };
  return map[budget] || 0.5;
}

function scoreInterests(interests: string[]): number {
  // More interests = higher engagement score
  return Math.min(interests.length / 3, 1.0);
}

function scoreProgramming(programming: string): number {
  const map: Record<string, number> = {
    none: 0.2,
    basic: 0.5,
    intermediate: 0.75,
    advanced: 1.0
  };
  return map[programming] || 0.5;
}

function scoreCertification(cert: string): number {
  const map: Record<string, number> = {
    'not-important': 0.3,
    'nice-to-have': 0.6,
    required: 1.0
  };
  return map[cert] || 0.5;
}

function scoreAvailability(avail: string): number {
  const map: Record<string, number> = {
    '0-5h': 0.3,
    '5-10h': 0.6,
    '10-20h': 0.8,
    '20+h': 1.0
  };
  return map[avail] || 0.5;
}

// Removed scoring functions for fields no longer in QuizAnswers:
// - scoreBackground (background field removed)
// - scoreSpecialization (specialization field removed)
// - scoreLearningStyle (learningStyle field removed)
// - scorePriorProjects (priorProjects field removed)

function scoreMathBackground(math: string): number {
  const map: Record<string, number> = {
    minimal: 0.3,
    basic: 0.6,
    strong: 0.8,
    advanced: 1.0
  };
  return map[math] || 0.5;
}
