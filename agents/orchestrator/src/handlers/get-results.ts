/**
 * Get Quiz Results Handler
 * Retrieve previously submitted quiz results
 */

import { Request, Response } from 'express';
import { verifyAuthHeader } from '@aicin/utils';
import { query } from '@aicin/database';

/**
 * GET /api/v1/quiz/results/:submissionId
 * Get quiz results by submission ID
 */
export async function getResultsHandler(req: Request, res: Response): Promise<void> {
  const correlationId = (req as any).correlationId as string;

  try {
    // Verify JWT authentication
    const authHeader = req.headers.authorization as string;
    const JWT_SECRET = process.env.JWT_SECRET || '';

    if (!JWT_SECRET) {
      res.status(500).json({ error: 'JWT secret not configured' });
      return;
    }

    let userId: number;
    try {
      userId = verifyAuthHeader(authHeader, JWT_SECRET);
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Invalid token'
      });
      return;
    }

    const submissionId = parseInt(req.params.submissionId);

    if (isNaN(submissionId)) {
      res.status(400).json({
        error: 'Invalid submission ID',
        message: 'Submission ID must be a number'
      });
      return;
    }

    console.log(`[${correlationId}] Fetching results for submission ${submissionId}, user ${userId}`);

    // Fetch submission and verify ownership
    const submissionResult = await query(`
      SELECT
        qs.*,
        qsu.user_id
      FROM quiz_submissions qs
      JOIN quiz_submissions_user_lnk qsu ON qs.id = qsu.quiz_submission_id
      WHERE qs.id = $1
    `, [submissionId]);

    if (submissionResult.rows.length === 0) {
      res.status(404).json({
        error: 'Submission not found'
      });
      return;
    }

    const submission = submissionResult.rows[0];

    // Verify ownership
    if (submission.user_id !== userId) {
      res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to view this submission'
      });
      return;
    }

    // Fetch recommendations
    const recommendationsResult = await query(`
      SELECT
        qr.*,
        lp.id as path_id,
        lp.title as path_title,
        lp.slug as path_slug,
        lp.description as path_description,
        lp.level as path_level,
        lp.estimated_hours,
        lp.total_cost,
        lp.has_certificate
      FROM quiz_recommendations qr
      JOIN quiz_recommendations_submission_lnk qrs ON qr.id = qrs.quiz_recommendation_id
      JOIN quiz_recommendations_path_lnk qrp ON qr.id = qrp.quiz_recommendation_id
      JOIN learning_paths lp ON qrp.learning_path_id = lp.id
      WHERE qrs.quiz_submission_id = $1
      ORDER BY qr.rank ASC
    `, [submissionId]);

    const recommendations = recommendationsResult.rows.map(rec => ({
      pathId: rec.path_id,
      pathTitle: rec.path_title,
      pathSlug: rec.path_slug,
      pathDescription: rec.path_description,
      pathLevel: rec.path_level,
      estimatedHours: rec.estimated_hours,
      totalCost: rec.total_cost,
      hasCertificate: rec.has_certificate,
      matchScore: rec.match_score,
      confidence: rec.confidence,
      matchReasons: rec.match_reasons,
      categoryBreakdown: rec.category_breakdown,
      rank: rec.rank
    }));

    console.log(`[${correlationId}] Found ${recommendations.length} recommendations`);

    res.json({
      submissionId: submission.id,
      submission: {
        id: submission.id,
        answers: submission.answers,
        scores: submission.scores,
        submittedAt: submission.submitted_at,
        version: submission.version
      },
      categoryScores: submission.scores || {},
      recommendations
    });

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      error: 'Failed to fetch quiz results',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
}
