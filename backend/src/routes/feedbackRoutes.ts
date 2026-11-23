import { Router } from 'express';
import {
  getPublishedFeedback,
  getMyFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getAllFeedbackForAdmin,
  moderateFeedback,
} from '../controllers/feedbackController.js';
import { authenticate, requireRole, requireVerified, validateCsrf } from '../middleware/auth.js';

const router = Router();

// Publicly readable reviews
router.get('/', getPublishedFeedback);

// Authenticated user operations
router.get('/my', authenticate, getMyFeedback);
router.post('/', authenticate, requireVerified, validateCsrf, createFeedback);
router.put('/:id', authenticate, validateCsrf, updateFeedback);
router.delete('/:id', authenticate, validateCsrf, deleteFeedback);

// Manager moderation operations
router.get('/admin/all', authenticate, requireRole('MANAGER'), getAllFeedbackForAdmin);
router.patch('/admin/:id/moderate', authenticate, requireRole('MANAGER'), validateCsrf, moderateFeedback);

export default router;

