import { Request, Response } from 'express';
import { pool } from '../config/db.js';

/**
 * GET /api/verification/pending
 * MANAGER only: List all users pending affiliation verification.
 */
export async function getPendingVerifications(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT user_id, email, full_name, role, student_category, phone_number,
              verification_status, created_at, verification_notes
       FROM users
       WHERE verification_status = 'PENDING' AND role != 'MANAGER'
       ORDER BY created_at ASC`
    );

    res.json({ pendingUsers: rows });
  } catch (error: any) {
    console.error('[VERIFICATION_PENDING_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve pending verifications.' });
  }
}

/**
 * POST /api/verification/review
 * MANAGER only: Approve (VERIFIED) or Reject (REJECTED) user affiliation.
 * Implements strict ascending row-lock ordering to prevent database deadlocks.
 */
export async function reviewVerification(req: Request, res: Response): Promise<void> {
  const managerUserId = req.user!.userId;
  const { targetUserId, decision, notes } = req.body;

  if (!targetUserId || !decision || !['VERIFIED', 'REJECTED'].includes(decision)) {
    res.status(400).json({ error: 'Valid targetUserId and decision (VERIFIED or REJECTED) are required.' });
    return;
  }

  if (managerUserId === targetUserId) {
    res.status(400).json({ error: 'Managers cannot review their own account verification.' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Ascending row-lock order to prevent deadlocks:
    const [firstId, secondId] = managerUserId < targetUserId
      ? [managerUserId, targetUserId]
      : [targetUserId, managerUserId];

    const [firstLock]: any = await connection.query(
      `SELECT user_id, role, account_status, verification_status FROM users WHERE user_id = ? FOR UPDATE`,
      [firstId]
    );

    const [secondLock]: any = await connection.query(
      `SELECT user_id, role, account_status, verification_status FROM users WHERE user_id = ? FOR UPDATE`,
      [secondId]
    );

    if (firstLock.length === 0 || secondLock.length === 0) {
      await connection.rollback();
      res.status(404).json({ error: 'One or both user accounts not found.' });
      return;
    }

    const managerRow = firstId === managerUserId ? firstLock[0] : secondLock[0];
    const targetRow = firstId === targetUserId ? firstLock[0] : secondLock[0];

    // Verify manager role & status
    if (managerRow.role !== 'MANAGER' || managerRow.account_status !== 'ACTIVE') {
      await connection.rollback();
      res.status(403).json({ error: 'Active MANAGER privileges required.' });
      return;
    }

    const previousStatus = targetRow.verification_status;

    // 2. Update target user
    await connection.query(
      `UPDATE users
       SET verification_status = ?,
           verification_reviewed_by_user_id = ?,
           verification_reviewed_at = CURRENT_TIMESTAMP,
           verification_notes = ?
       WHERE user_id = ?`,
      [decision, managerUserId, notes || null, targetUserId]
    );

    // 3. Insert audit log record (immutable table)
    await connection.query(
      `INSERT INTO user_verification_audit
       (user_id, reviewed_by_user_id, previous_status, new_status, review_notes, reviewed_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [targetUserId, managerUserId, previousStatus, decision, notes || null]
    );

    await connection.commit();

    res.json({
      message: `User affiliation successfully updated to ${decision}.`,
      targetUserId,
      previousStatus,
      newStatus: decision,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[VERIFICATION_REVIEW_ERROR]', error);
    res.status(500).json({ error: 'Failed to process affiliation review.' });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/verification/reapply
 * STUDENT / FACULTY: Reapply for verification after rejection.
 * Resets status from REJECTED back to PENDING.
 */
export async function reapplyVerification(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { notes } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows]: any = await connection.query(
      `SELECT user_id, verification_status, account_status FROM users WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userRows[0];
    if (user.verification_status !== 'REJECTED') {
      await connection.rollback();
      res.status(400).json({
        error: `Only accounts with REJECTED status can reapply. Current status is ${user.verification_status}.`,
      });
      return;
    }

    // Reset status to PENDING
    await connection.query(
      `UPDATE users
       SET verification_status = 'PENDING',
           verification_reviewed_by_user_id = NULL,
           verification_reviewed_at = NULL,
           verification_notes = ?
       WHERE user_id = ?`,
      [notes ? `Reapplication: ${notes}` : 'User reapplied for verification', userId]
    );

    // Insert audit record
    await connection.query(
      `INSERT INTO user_verification_audit
       (user_id, reviewed_by_user_id, previous_status, new_status, review_notes, reviewed_at)
       VALUES (?, NULL, 'REJECTED', 'PENDING', ?, CURRENT_TIMESTAMP)`,
      [userId, notes ? `Reapplication: ${notes}` : 'User reapplication submitted']
    );

    await connection.commit();

    res.json({
      message: 'Reapplication submitted successfully. Your affiliation is now PENDING review.',
      verificationStatus: 'PENDING',
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[REAPPLY_VERIFICATION_ERROR]', error);
    res.status(500).json({ error: 'Failed to submit reapplication.' });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/verification/audit/:userId?
 * View verification audit history.
 * Managers can query any user; non-managers can only query their own history.
 */
export async function getVerificationAuditHistory(req: Request, res: Response): Promise<void> {
  try {
    const caller = req.user!;
    const requestedUserId = req.params.userId ? parseInt(req.params.userId, 10) : caller.userId;

    if (caller.role !== 'MANAGER' && caller.userId !== requestedUserId) {
      res.status(403).json({ error: 'You are only authorized to view your own verification audit history.' });
      return;
    }

    const [rows]: any = await pool.query(
      `SELECT a.audit_id, a.user_id, a.reviewed_by_user_id, a.previous_status, a.new_status,
              a.review_notes, a.reviewed_at,
              u.email AS user_email, u.full_name AS user_name,
              m.full_name AS reviewer_name, m.email AS reviewer_email
       FROM user_verification_audit a
       JOIN users u ON a.user_id = u.user_id
       LEFT JOIN users m ON a.reviewed_by_user_id = m.user_id
       WHERE a.user_id = ?
       ORDER BY a.reviewed_at DESC`,
      [requestedUserId]
    );

    res.json({ auditHistory: rows });
  } catch (error: any) {
    console.error('[VERIFICATION_AUDIT_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve verification audit history.' });
  }
}

