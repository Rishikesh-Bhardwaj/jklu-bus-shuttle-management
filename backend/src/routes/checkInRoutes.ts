import { Router } from 'express';
import {
  getTripManifest,
  markPassengerBoarded,
  markPassengerNoShow,
} from '../controllers/checkInController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

// Manifest and check-in actions require MANAGER role
router.use(authenticate, requireRole('MANAGER'));

router.get('/manifest/:tripId', getTripManifest);
router.post('/:bookingId/board', validateCsrf, markPassengerBoarded);
router.post('/:bookingId/no-show', validateCsrf, markPassengerNoShow);

export default router;

