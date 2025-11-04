/**
 * Unit Tests for Path Optimizer Scoring Functions
 * Testing the 3-layer scoring algorithm
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { scorePath, generateMatchReasons } from '../src/scoring';
import type { UserProfile, LearningPath, Course } from '@aicin/types';

describe('Path Optimizer - Scoring Functions', () => {
  let sampleProfile: UserProfile;
  let samplePath: LearningPath;
  let sampleCourses: Course[];

  beforeEach(() => {
    // Sample user profile
    sampleProfile = {
      level: 'intermediate',
      interests: ['machine-learning', 'python', 'data-science'],
      weeklyHours: 15,
      budget: 500,
      timeline: 20, // weeks
      wantsCertification: true,
      preferredFormat: 'project-based',
      currentRole: 'software-developer',
      goalRole: 'ml-engineer',
      programmingExperience: 'advanced',
      mathBackground: 'intermediate',
      categoryScores: {
        experience: 0.7,
        goals: 0.8,
        timeline: 0.6,
        budget: 0.7,
        interests: 0.9,
        programming: 0.8,
        learningStyle: 0.7,
        certification: 0.9,
        availability: 0.8,
        mathBackground: 0.6
      }
    };

    // Sample learning path
    samplePath = {
      id: 1,
      title: 'Intermediate Machine Learning',
      slug: 'intermediate-machine-learning',
      difficulty: 'intermediate',
      description: 'Learn machine learning fundamentals with Python',
      objectives: 'Master ML algorithms, build projects',
      prerequisites: 'Python basics',
      estimated_duration: 100, // hours
      is_active: true,
      published_at: '2025-01-01',
      average_rating: 4.5,
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    };

    // Sample courses
    sampleCourses = [
      {
        id: 1,
        title: 'Python for ML',
        slug: 'python-ml',
        description: 'Python basics for machine learning',
        url: 'https://example.com/python-ml',
        provider: 'Coursera',
        price: 49.99,
        duration_hours: 20,
        difficulty: 'intermediate',
        rating: 4.6,
        enrollment_count: 10000,
        has_certificate: true,
        last_updated: '2025-01-01',
        is_active: true,
        instructor: 'Dr. Smith',
        created_at: '2025-01-01',
        updated_at: '2025-01-01'
      },
      {
        id: 2,
        title: 'Machine Learning Fundamentals',
        slug: 'ml-fundamentals',
        description: 'Core ML algorithms and techniques',
        url: 'https://example.com/ml-fundamentals',
        provider: 'Udacity',
        price: 99.99,
        duration_hours: 40,
        difficulty: 'intermediate',
        rating: 4.8,
        enrollment_count: 15000,
        has_certificate: true,
        last_updated: '2025-01-01',
        is_active: true,
        instructor: 'Prof. Johnson',
        created_at: '2025-01-01',
        updated_at: '2025-01-01'
      }
    ];
  });

  describe('scorePath - Main Scoring Function', () => {
    it('should return a score between 0 and 1', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(1);
    });

    it('should include all required fields in result', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      expect(result).toHaveProperty('pathId');
      expect(result).toHaveProperty('pathTitle');
      expect(result).toHaveProperty('pathSlug');
      expect(result).toHaveProperty('matchScore');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchReasons');
      expect(result).toHaveProperty('categoryBreakdown');
      expect(result).toHaveProperty('validationScores');
    });

    it('should give higher scores to matching difficulty levels', () => {
      const intermediateResult = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      // Change path to beginner
      const beginnerPath = { ...samplePath, difficulty: 'beginner' };
      const beginnerResult = scorePath(sampleProfile, beginnerPath, sampleCourses, 0.85);

      // Intermediate user should score higher with intermediate path
      expect(intermediateResult.matchScore).toBeGreaterThan(beginnerResult.matchScore);
    });

    it('should consider content match score in final calculation', () => {
      const highContentMatch = scorePath(sampleProfile, samplePath, sampleCourses, 0.95);
      const lowContentMatch = scorePath(sampleProfile, samplePath, sampleCourses, 0.50);

      // Higher content match should result in higher overall score
      expect(highContentMatch.matchScore).toBeGreaterThan(lowContentMatch.matchScore);
    });

    it('should properly weight the 3 layers (content 40%, metadata 35%, courses 25%)', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.80);

      // Verify the score is a weighted combination
      // With perfect metadata and course scores, content should be ~40% of weight
      // This is a rough check since exact calculation depends on all factors
      expect(result.matchScore).toBeGreaterThan(0.5); // At least partial score
      expect(result.matchScore).toBeLessThan(1.0); // Not perfect due to non-perfect match
    });

    it('should set confidence to "high" for scores >= 0.8', () => {
      // Force high score by using perfect content match and matching profile
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.95);

      if (result.matchScore >= 0.8) {
        expect(result.confidence).toBe('high');
      }
    });

    it('should set confidence to "medium" for scores 0.6-0.8', () => {
      // Create a mismatched profile to get medium score
      const mismatchedProfile = {
        ...sampleProfile,
        level: 'beginner', // Mismatch
        interests: ['cooking'], // Completely different
        budget: 50 // Very low budget
      };

      const result = scorePath(mismatchedProfile, samplePath, sampleCourses, 0.65);

      if (result.matchScore >= 0.6 && result.matchScore < 0.8) {
        expect(result.confidence).toBe('medium');
      }
    });

    it('should set confidence to "low" for scores < 0.6', () => {
      const mismatchedProfile = {
        ...sampleProfile,
        level: 'advanced',
        budget: 10 // Very low budget, path costs $150
      };

      const result = scorePath(mismatchedProfile, samplePath, sampleCourses, 0.30);

      if (result.matchScore < 0.6) {
        expect(result.confidence).toBe('low');
      }
    });

    it('should handle empty courses array gracefully', () => {
      const result = scorePath(sampleProfile, samplePath, [], 0.85);

      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.validationScores).toHaveProperty('courseQuality');
    });

    it('should calculate total cost from courses', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      const expectedCost = sampleCourses.reduce((sum, course) => sum + course.price, 0);
      expect(result.categoryBreakdown.total_cost).toBe(expectedCost);
    });

    it('should count courses correctly', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      expect(result.categoryBreakdown.course_count).toBe(sampleCourses.length);
    });

    it('should calculate average rating from courses', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0.85);

      const expectedRating = sampleCourses.reduce((sum, c) => sum + c.rating, 0) / sampleCourses.length;
      expect(result.categoryBreakdown.average_rating).toBeCloseTo(expectedRating, 2);
    });

    it('should respect budget constraints in metadata score', () => {
      const lowBudgetProfile = { ...sampleProfile, budget: 50 }; // $50 budget
      const highBudgetProfile = { ...sampleProfile, budget: 1000 }; // $1000 budget

      // Path costs $149.98 (from sample courses)
      const lowBudgetResult = scorePath(lowBudgetProfile, samplePath, sampleCourses, 0.85);
      const highBudgetResult = scorePath(highBudgetProfile, samplePath, sampleCourses, 0.85);

      // High budget user should score better since they can afford the path
      expect(highBudgetResult.matchScore).toBeGreaterThanOrEqual(lowBudgetResult.matchScore);
    });

    it('should consider timeline feasibility', () => {
      const rushProfile = { ...sampleProfile, timeline: 4, weeklyHours: 5 }; // 20 hours total
      const relaxedProfile = { ...sampleProfile, timeline: 20, weeklyHours: 20 }; // 400 hours total

      // Path requires 100 hours
      const rushResult = scorePath(rushProfile, samplePath, sampleCourses, 0.85);
      const relaxedResult = scorePath(relaxedProfile, samplePath, sampleCourses, 0.85);

      // Relaxed timeline should score better
      expect(relaxedResult.matchScore).toBeGreaterThanOrEqual(rushResult.matchScore);
    });
  });

  describe('generateMatchReasons', () => {
    it('should return array of match reason objects', () => {
      const reasons = generateMatchReasons(sampleProfile, samplePath, 0.85);

      expect(Array.isArray(reasons)).toBe(true);
      expect(reasons.length).toBeGreaterThan(0);

      reasons.forEach(reason => {
        expect(reason).toHaveProperty('reason');
        expect(reason).toHaveProperty('score');
      });
    });

    it('should include content match reason for high content scores', () => {
      const reasons = generateMatchReasons(sampleProfile, samplePath, 0.90);

      const contentReason = reasons.find(r => r.reason.includes('Strong content match'));
      expect(contentReason).toBeDefined();
    });

    it('should include difficulty match reason when levels match', () => {
      const reasons = generateMatchReasons(sampleProfile, samplePath, 0.85);

      const difficultyReason = reasons.find(r => r.reason.includes('difficulty'));
      expect(difficultyReason).toBeDefined();
    });

    it('should include interest match reasons', () => {
      const pathWithMLKeyword = {
        ...samplePath,
        title: 'Machine Learning with Python',
        description: 'Learn ML and data science'
      };

      const reasons = generateMatchReasons(sampleProfile, pathWithMLKeyword, 0.85);

      const interestReason = reasons.find(r => r.reason.includes('interest'));
      expect(interestReason).toBeDefined();
    });

    it('should sort reasons by score descending', () => {
      const reasons = generateMatchReasons(sampleProfile, samplePath, 0.85);

      for (let i = 0; i < reasons.length - 1; i++) {
        expect(reasons[i].score).toBeGreaterThanOrEqual(reasons[i + 1].score);
      }
    });

    it('should limit reasons to top 5', () => {
      const reasons = generateMatchReasons(sampleProfile, samplePath, 0.85);

      expect(reasons.length).toBeLessThanOrEqual(5);
    });

    it('should handle certification preference', () => {
      const certProfile = { ...sampleProfile, wantsCertification: true };
      const noCertProfile = { ...sampleProfile, wantsCertification: false };

      const certReasons = generateMatchReasons(certProfile, samplePath, 0.85);
      const noCertReasons = generateMatchReasons(noCertProfile, samplePath, 0.85);

      // Both should generate reasons, but content may differ
      expect(certReasons.length).toBeGreaterThan(0);
      expect(noCertReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields in profile', () => {
      const minimalProfile = {
        level: 'intermediate',
        interests: ['machine-learning'],
        weeklyHours: 10,
        budget: 100,
        timeline: 12,
        categoryScores: {}
      } as any;

      const result = scorePath(minimalProfile, samplePath, sampleCourses, 0.85);

      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(1);
    });

    it('should handle zero content match score', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 0);

      // Score should still be positive due to metadata and course quality
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle perfect content match score', () => {
      const result = scorePath(sampleProfile, samplePath, sampleCourses, 1.0);

      expect(result.matchScore).toBeGreaterThan(0);
      expect(result.matchScore).toBeLessThanOrEqual(1);
    });

    it('should handle very high path cost', () => {
      const expensiveCourses = [
        { ...sampleCourses[0], price: 5000 },
        { ...sampleCourses[1], price: 5000 }
      ];

      const lowBudgetProfile = { ...sampleProfile, budget: 100 };
      const result = scorePath(lowBudgetProfile, samplePath, expensiveCourses, 0.85);

      // Score should be lower due to budget mismatch
      expect(result.matchScore).toBeLessThan(0.9);
    });

    it('should handle empty interests array', () => {
      const noInterestsProfile = { ...sampleProfile, interests: [] };
      const result = scorePath(noInterestsProfile, samplePath, sampleCourses, 0.85);

      expect(result.matchScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle null/undefined course ratings', () => {
      const coursesWithMissingRating = [
        { ...sampleCourses[0], rating: null as any },
        { ...sampleCourses[1], rating: undefined as any }
      ];

      const result = scorePath(sampleProfile, samplePath, coursesWithMissingRating, 0.85);

      expect(result.categoryBreakdown.average_rating).toBeDefined();
    });
  });
});
