import { Router } from 'express';
import {
  getPendingVerifications,
  reviewVerification,
  reapplyVerification,
  getVerificationAuditHistory,
} from '../controllers/verificationController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

// All verification endpoints require authentication
router.use(authenticate);

// MANAGER only: List pending users
router.get('/pending', requireRole('MANAGER'), getPendingVerifications);

// MANAGER only: Review user (Approve / Reject) with deadlock-safe ascending row-locks
router.post('/review', requireRole('MANAGER'), validateCsrf, reviewVerification);

// STUDENT / FACULTY: Reapply if rejected
router.post('/reapply', validateCsrf, reapplyVerification);

// Audit history (Self or MANAGER)
router.get('/audit/:userId?', getVerificationAuditHistory);

export default router;

