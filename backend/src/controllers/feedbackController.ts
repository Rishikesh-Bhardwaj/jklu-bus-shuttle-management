import { Request, Response } from 'express';
import { pool } from '../config/db.js';

/**
 * GET /api/feedback
 * Public / Authenticated: Retrieve published feedback and calculated average ratings.
 */
export async function getPublishedFeedback(req: Request, res: Response): Promise<void> {
  try {
    const [reviews]: any = await pool.query(
      `SELECT f.feedback_id, f.user_id, f.rating, f.review_text, f.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM feedback f
       JOIN users u ON f.user_id = u.user_id
       WHERE f.moderation_status = 'PUBLISHED'
       ORDER BY f.created_at DESC`
    );

    // Calculate statistical rating averages
    const totalCount = reviews.length;
    let averageRating = 0;
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (totalCount > 0) {
      let sum = 0;
      for (const r of reviews) {
        sum += r.rating;
        const star = r.rating as 1 | 2 | 3 | 4 | 5;
        if (ratingBreakdown[star] !== undefined) {
          ratingBreakdown[star]++;
        }
      }
      averageRating = parseFloat((sum / totalCount).toFixed(2));
    }

    res.json({
      reviews,
      statistics: {
        totalReviews: totalCount,
        averageRating,
        ratingBreakdown,
      },
    });
  } catch (error: any) {
    console.error('[FEEDBACK_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve feedback.' });
  }
}

/**
 * GET /api/feedback/my
 * Authenticated: Retrieve reviews written by the caller.
 */
export async function getMyFeedback(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const [rows]: any = await pool.query(
      `SELECT feedback_id, user_id, rating, review_text, moderation_status, created_at, updated_at
       FROM feedback
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ feedback: rows });
  } catch (error: any) {
    console.error('[MY_FEEDBACK_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve your feedback.' });
  }
}

/**
 * POST /api/feedback
 * Verified user: Submit feedback and rating (1-5).
 */
export async function createFeedback(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { rating, reviewText } = req.body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'A rating between 1 and 5 is required.' });
      return;
    }

    if (!reviewText || !reviewText.trim()) {
      res.status(400).json({ error: 'Review text cannot be empty.' });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO feedback (user_id, rating, review_text, moderation_status)
       VALUES (?, ?, ?, 'PUBLISHED')`,
      [userId, Math.round(rating), reviewText.trim()]
    );

    res.status(201).json({
      message: 'Thank you for your feedback! It has been published.',
      feedbackId: result.insertId,
    });
  } catch (error: any) {
    console.error('[FEEDBACK_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
}

/**
 * PUT /api/feedback/:id
 * User: Edit their own feedback.
 */
export async function updateFeedback(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const feedbackId = parseInt(req.params.id, 10);
    const { rating, reviewText } = req.body;

    if (rating && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      return;
    }

    const [result]: any = await pool.query(
      `UPDATE feedback
       SET rating = COALESCE(?, rating),
           review_text = COALESCE(?, review_text)
       WHERE feedback_id = ? AND user_id = ?`,
      [rating ? Math.round(rating) : null, reviewText ? reviewText.trim() : null, feedbackId, userId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Feedback record not found or not authored by you.' });
      return;
    }

    res.json({ message: 'Feedback updated successfully.', feedbackId });
  } catch (error: any) {
    console.error('[FEEDBACK_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update feedback.' });
  }
}

/**
 * DELETE /api/feedback/:id
 * User or MANAGER: Delete feedback.
 */
export async function deleteFeedback(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const feedbackId = parseInt(req.params.id, 10);

    let query = `DELETE FROM feedback WHERE feedback_id = ?`;
    const params: any[] = [feedbackId];

    if (userRole !== 'MANAGER') {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    const [result]: any = await pool.query(query, params);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Feedback record not found or unauthorized.' });
      return;
    }

    res.json({ message: 'Feedback deleted successfully.', feedbackId });
  } catch (error: any) {
    console.error('[FEEDBACK_DELETE_ERROR]', error);
    res.status(500).json({ error: 'Failed to delete feedback.' });
  }
}

/**
 * GET /api/feedback/admin/all
 * MANAGER only: Retrieve all feedback including hidden reviews.
 */
export async function getAllFeedbackForAdmin(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT f.feedback_id, f.user_id, f.rating, f.review_text, f.moderation_status,
              f.created_at, f.updated_at,
              u.full_name AS author_name, u.email AS author_email, u.role AS author_role
       FROM feedback f
       JOIN users u ON f.user_id = u.user_id
       ORDER BY f.created_at DESC`
    );

    res.json({ allFeedback: rows });
  } catch (error: any) {
    console.error('[FEEDBACK_ADMIN_ALL_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve feedback for admin.' });
  }
}

/**
 * PATCH /api/feedback/admin/:id/moderate
 * MANAGER only: Set moderation status to PUBLISHED or HIDDEN.
 */
export async function moderateFeedback(req: Request, res: Response): Promise<void> {
  try {
    const feedbackId = parseInt(req.params.id, 10);
    const { moderationStatus } = req.body;

    if (!moderationStatus || !['PUBLISHED', 'HIDDEN'].includes(moderationStatus)) {
      res.status(400).json({ error: 'moderationStatus must be PUBLISHED or HIDDEN.' });
      return;
    }

    const [result]: any = await pool.query(
      `UPDATE feedback SET moderation_status = ? WHERE feedback_id = ?`,
      [moderationStatus, feedbackId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Feedback record not found.' });
      return;
    }

    res.json({
      message: `Feedback moderation status updated to ${moderationStatus}.`,
      feedbackId,
      moderationStatus,
    });
  } catch (error: any) {
    console.error('[FEEDBACK_MODERATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to moderate feedback.' });
  }
}

