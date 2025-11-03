/**
 * Database Queries
 * Reusable SQL queries for learning paths and courses
 */

import { query } from './pool';
import type { LearningPath, Course } from '@aicin/types';

/**
 * Fetch all active learning paths with enriched metadata
 */
export async function fetchActiveLearningPaths(): Promise<LearningPath[]> {
  const result = await query<any>(`
    SELECT
      lp.id,
      lp.document_id,
      lp.title,
      lp.slug,
      lp.description,
      lp.difficulty as level,
      lp.total_realistic_hours as estimated_hours,
      lp.total_cost,
      false as has_certificate,
      lp.target_goals as topics,
      lp.enriched_metadata,
      lp.completeness_score,
      lp.last_enriched_at,
      lp.is_active,
      lp.updated_at,
      COUNT(DISTINCT lpc.course_id) as course_count
    FROM learning_paths lp
    LEFT JOIN learning_paths_courses_lnk lpc ON lp.id = lpc.learning_path_id
    WHERE lp.is_active = true
      AND lp.published_at IS NOT NULL
    GROUP BY lp.id, lp.document_id, lp.title, lp.slug, lp.description,
             lp.difficulty, lp.total_realistic_hours, lp.total_cost,
             lp.target_goals, lp.enriched_metadata, lp.completeness_score,
             lp.last_enriched_at, lp.is_active, lp.updated_at
    ORDER BY lp.updated_at DESC
  `);

  return result.rows as LearningPath[];
}

/**
 * Fetch courses for a specific learning path
 */
export async function fetchCoursesForPath(pathId: number): Promise<Course[]> {
  const result = await query<any>(`
    SELECT
      c.id,
      c.document_id,
      c.title,
      c.instructor as provider_name,
      c.difficulty as level,
      c.total_hours as duration_hours,
      c.price,
      c.rating,
      c.url,
      c.rating as quality_score,
      jsonb_build_object(
        'topics', COALESCE(c.topics, '[]'::jsonb),
        'key_topics', COALESCE(c.key_topics, '[]'::jsonb)
      ) as content_data
    FROM courses c
    JOIN learning_paths_courses_lnk lpc ON c.id = lpc.course_id
    WHERE lpc.learning_path_id = $1
      AND c.published_at IS NOT NULL
    ORDER BY lpc.course_ord
  `, [pathId]);

  return result.rows.map(c => ({
    ...c,
    topics: c.content_data?.topics || []
  }));
}

/**
 * Fetch all courses for multiple paths (batched)
 */
export async function fetchCoursesForPaths(pathIds: number[]): Promise<Map<number, Course[]>> {
  const result = await query<any>(`
    SELECT
      c.id,
      c.document_id,
      c.title,
      c.instructor as provider_name,
      c.difficulty as level,
      c.total_hours as duration_hours,
      c.price,
      c.rating,
      c.url,
      c.rating as quality_score,
      jsonb_build_object(
        'topics', COALESCE(c.topics, '[]'::jsonb),
        'key_topics', COALESCE(c.key_topics, '[]'::jsonb)
      ) as content_data,
      lpc.learning_path_id
    FROM courses c
    JOIN learning_paths_courses_lnk lpc ON c.id = lpc.course_id
    WHERE lpc.learning_path_id = ANY($1::int[])
      AND c.published_at IS NOT NULL
    ORDER BY lpc.learning_path_id, lpc.course_ord
  `, [pathIds]);

  // Group by path ID
  const coursesByPath = new Map<number, Course[]>();

  for (const row of result.rows) {
    const pathId = row.learning_path_id;
    if (!coursesByPath.has(pathId)) {
      coursesByPath.set(pathId, []);
    }

    const course: Course = {
      id: row.id,
      document_id: row.document_id,
      title: row.title,
      provider_name: row.provider_name,
      level: row.level,
      duration_hours: row.duration_hours,
      price: row.price,
      rating: row.rating,
      url: row.url,
      quality_score: row.quality_score,
      topics: row.content_data?.topics || []
    };

    coursesByPath.get(pathId)!.push(course);
  }

  return coursesByPath;
}

/**
 * Save quiz submission
 */
export async function saveQuizSubmission(
  userId: number,
  answers: any,
  scores: any
): Promise<number> {
  const result = await query<{ id: number }>(`
    INSERT INTO quiz_submissions (
      document_id,
      answers,
      scores,
      submitted_at,
      version,
      published_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      $1::jsonb,
      $2::jsonb,
      $3,
      'v2.0',
      $3,
      $3,
      $3
    ) RETURNING id
  `, [JSON.stringify(answers), JSON.stringify(scores), new Date()]);

  const submissionId = result.rows[0].id;

  // Link to user
  await query(`
    INSERT INTO quiz_submissions_user_lnk (quiz_submission_id, user_id)
    VALUES ($1, $2)
  `, [submissionId, userId]);

  return submissionId;
}

/**
 * Save quiz recommendations
 */
export async function saveQuizRecommendations(
  submissionId: number,
  recommendations: Array<{
    pathId: number;
    matchScore: number;
    matchReasons: any[];
    confidence: string;
    rank: number;
    categoryBreakdown: any;
  }>
): Promise<void> {
  for (const rec of recommendations) {
    const recResult = await query<{ id: number }>(`
      INSERT INTO quiz_recommendations (
        document_id,
        match_score,
        match_reasons,
        confidence,
        rank,
        category_breakdown,
        published_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2::jsonb,
        $3,
        $4,
        $5::jsonb,
        $6,
        $6,
        $6
      ) RETURNING id
    `, [
      rec.matchScore,
      JSON.stringify(rec.matchReasons),
      rec.confidence,
      rec.rank,
      JSON.stringify(rec.categoryBreakdown),
      new Date()
    ]);

    const recId = recResult.rows[0].id;

    // Link to submission
    await query(`
      INSERT INTO quiz_recommendations_submission_lnk (quiz_recommendation_id, quiz_submission_id)
      VALUES ($1, $2)
    `, [recId, submissionId]);

    // Link to path
    await query(`
      INSERT INTO quiz_recommendations_path_lnk (quiz_recommendation_id, learning_path_id)
      VALUES ($1, $2)
    `, [recId, rec.pathId]);
  }
}

/**
 * Update user profile after quiz completion
 */
export async function updateUserProfile(
  userId: number,
  profileData: {
    learningGoals: string;
    experienceLevel: string;
    availabilityHours: number;
    budgetRange: any;
    // Removed in Phase 2 (fields no longer in quiz):
    // learningStyle: string;
    // industry: string;
  }
): Promise<void> {
  await query(`
    UPDATE up_users
    SET
      profile_completed = true,
      quiz_completed_at = $1,
      learning_goals = $2,
      experience_level = $3,
      availability_hours = $4,
      budget_range = $5::jsonb,
      updated_at = $1
    WHERE id = $6
  `, [
    new Date(),
    profileData.learningGoals,
    profileData.experienceLevel,
    profileData.availabilityHours,
    JSON.stringify(profileData.budgetRange),
    // Removed: learningStyle and industry (fields no longer in quiz)
    userId
  ]);
}
