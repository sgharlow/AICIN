/**
 * AICIN Shared Types
 * Common interfaces used across all agents
 */

// ============================================================================
// Agent Communication Types
// ============================================================================

export interface AgentMessage<T = any> {
  agentId: string;           // Source agent identifier
  correlationId: string;     // Request tracking across agents
  timestamp: Date;           // Message creation time
  payload: T;                // Agent-specific payload
  metadata: MessageMetadata; // Processing metadata
}

export interface MessageMetadata {
  processingTimeMs?: number;
  cacheHit?: boolean;
  confidenceScore?: number;
  version?: string;
}

// ============================================================================
// User Profile Types
// ============================================================================

export interface QuizAnswers {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  learningGoal: 'career-switch' | 'upskill' | 'exploration' | 'certification';
  availability: '0-5h' | '5-10h' | '10-20h' | '20+h';
  budget: '$0' | '$0-100' | '$100-500' | '$500+';
  background: 'tech' | 'non-tech' | 'student' | 'other';
  interests: string[];
  programming: 'none' | 'basic' | 'intermediate' | 'advanced';
  specialization: 'generalist' | 'specialist';
  learningStyle: 'video' | 'reading' | 'hands-on' | 'mixed';
  certification: 'not-important' | 'nice-to-have' | 'required';
  timeline: 'flexible' | '3-6-months' | '1-3-months' | 'asap';
  priorProjects: '0' | '1-2' | '3-5' | '5+';
  mathBackground: 'minimal' | 'basic' | 'strong' | 'advanced';
  industry: string;
  teamPreference: 'individual' | 'team' | 'both';
}

export interface UserProfile {
  // Explicit preferences (from quiz)
  interests: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  learningGoal: 'career-switch' | 'upskill' | 'exploration' | 'certification';
  programmingExperience: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert';
  mathBackground: 'none' | 'basic' | 'intermediate' | 'advanced';

  // Constraints
  maxBudget: number;
  weeklyHours: number;
  timeline: number; // weeks

  // Preferences
  preferredFormat?: 'video' | 'reading' | 'hands-on' | 'mixed';
  wantsCertification?: boolean;

  // Derived features (calculated by ProfileAnalyzer)
  interestVector?: number[];
  skillGapScore?: number;
  urgencyFactor?: number;
}

// ============================================================================
// Learning Path & Course Types
// ============================================================================

export interface LearningPath {
  id: number;
  document_id: string;
  title: string;
  slug: string;
  description: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  estimated_hours?: number;
  total_cost?: number;
  has_certificate?: boolean;
  topics?: string[];
  enriched_metadata?: EnrichedMetadata;
  completeness_score?: number;
  last_enriched_at?: Date;
  is_active: boolean;
  updated_at: Date;
  course_count?: number;
}

export interface Course {
  id: number;
  document_id: string;
  title: string;
  provider_name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_hours?: number;
  price?: number;
  rating?: number;
  url: string;
  quality_score?: number;
  topics?: string[];
  content_data?: any;
}

// ============================================================================
// Enriched Metadata Types
// ============================================================================

export interface EnrichedMetadata {
  // ContentAnalyzer fields
  documentId?: string;
  topTerms?: Array<{ term: string; tfidf: number }>;
  contentVector?: number[];

  // MetadataEnricher fields
  inferredTopics?: string[];
  topicExtractionMethod?: string;
  inferredDifficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Mixed';
  difficultyDistribution?: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  inferredDuration?: number;
  durationSource?: string;
  inferredCost?: number;
  costBreakdown?: {
    free: number;
    paid: number;
    totalCost: number;
  };
  inferredPrerequisites?: string[];
  courseQualityMetrics?: {
    averageRating: number;
    totalReviews: number;
    courseCount: number;
  };
  completenessScore?: number;
  completenessBreakdown?: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasTopics: boolean;
    hasDifficulty: boolean;
    hasDuration: boolean;
    hasCost: boolean;
    hasCertificate: boolean;
    hasCourses: boolean;
  };
  hasLogicalProgression?: boolean;
  coversBreadth?: boolean;
  aiGeneratedSummary?: string;
  lastEnrichedAt?: string;
  enrichmentVersion?: string;
}

// ============================================================================
// Scoring Types
// ============================================================================

export interface LayerWeights {
  content: number;    // TF-IDF layer weight
  metadata: number;   // Structured attributes layer weight
  courses: number;    // Course-level validation layer weight
}

export interface LayerScores {
  content: number;    // Content similarity score (0-1)
  metadata: number;   // Metadata match score (0-1)
  courses: number;    // Course quality score (0-1)
}

export interface ValidationScores {
  difficulty_fit: number;         // 0-1: Course difficulties match learner level
  topic_coverage: number;         // 0-1: Percentage of learner interests covered
  time_alignment: number;         // 0-1: Path fits learner's time availability
  budget_fit: number;             // 0-1: Path fits learner's budget
  format_match: number;           // 0-1: Learning formats match preferences
  prerequisite_match: number;     // 0-1: Learner meets prerequisites
  overall_validation: number;     // 0-1: Average of all scores
  validation_pass: boolean;       // True if overall >= 0.6
  validated_courses: number;      // Number of courses checked
  mismatched_courses: MismatchedCourse[];
}

export interface MismatchedCourse {
  course_id: number;
  course_title: string;
  reason: string;
}

// ============================================================================
// Match Results
// ============================================================================

export interface PathMatchResult {
  pathId: number;
  pathTitle: string;
  pathSlug: string;
  matchScore: number;
  confidence: 'low' | 'medium' | 'high';
  matchReasons: MatchReason[];
  categoryBreakdown: Record<string, number>;
  layerBreakdown?: LayerScores;
  validationScores?: ValidationScores;
}

export interface MatchReason {
  reason: string;
  weight: number;
  category: string;
  evidence?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface QuizSubmissionRequest {
  answers: QuizAnswers;
  userId?: number;
  mode?: 'real_time' | 'batch';
}

export interface QuizSubmissionResponse {
  submissionId: number;
  recommendations: PathMatchResult[];
  categoryScores: Record<string, number>;
  processingTimeMs: number;
  correlationId: string;
}

export interface RecommendationResponse {
  pathId: number;
  pathTitle: string;
  pathSlug: string;
  pathDescription?: string;
  rank: number;
  matchScore: number;
  confidence: 'low' | 'medium' | 'high';
  matchReasons: string[];
  categoryBreakdown: Record<string, number>;
  validationScores?: ValidationScores;
}

// ============================================================================
// Agent-Specific Payloads
// ============================================================================

export interface ProfileAnalyzerPayload {
  answers: QuizAnswers;
  userId?: number;
}

export interface ProfileAnalyzerResult {
  userProfile: UserProfile;
  categoryScores: Record<string, number>;
}

export interface ContentMatcherPayload {
  userProfile: UserProfile;
  learningPaths: LearningPath[];
}

export interface ContentMatcherResult {
  contentScores: Map<string, number>; // pathId -> content score
  topMatches: Array<{ pathId: string; score: number }>;
}

export interface PathOptimizerPayload {
  userProfile: UserProfile;
  contentScores: Map<string, number> | Record<string, number>;
  learningPaths: LearningPath[];
  courses: Record<number, Course[]> | Map<number, Course[]>; // pathId -> courses (serialized as object over HTTP)
}

export interface PathOptimizerResult {
  rankedPaths: PathMatchResult[];
  processingStats: {
    pathsEvaluated: number;
    averageScore: number;
    topScore: number;
  };
}

export interface CourseValidatorPayload {
  userProfile: UserProfile;
  courses: Course[];
}

export interface CourseValidatorResult {
  validationScores: ValidationScores;
  recommendations: string[];
}

export interface RecommendationBuilderPayload {
  rankedPaths: PathMatchResult[];
  userProfile: UserProfile;
  topN?: number;
}

export interface RecommendationBuilderResult {
  recommendations: RecommendationResponse[];
}

export interface FeedbackEvent {
  userId: number;
  submissionId: number;
  pathId: number;
  eventType: 'clicked' | 'enrolled' | 'completed_module' | 'completed_course' | 'got_job';
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  version: string;
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type LearningGoal = 'career-switch' | 'upskill' | 'exploration' | 'certification';
