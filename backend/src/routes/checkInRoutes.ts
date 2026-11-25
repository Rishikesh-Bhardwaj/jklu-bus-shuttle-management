import { Router } from 'express';
import {
  getTripManifest,
  markPassengerBoarded,
  markPassengerNoShow,
  generateTripCheckInQr,
  scanBusCheckInQr,
} from '../controllers/checkInController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

// All check-in actions require an authenticated account.
router.use(authenticate);

// Students/faculty scan the bus QR from their own account.
router.post('/scan', requireRole('STUDENT', 'FACULTY'), validateCsrf, scanBusCheckInQr);

// Manager-only manifest, QR generation and manual fallback controls.
router.get('/manifest/:tripId', requireRole('MANAGER'), getTripManifest);
router.post('/trips/:tripId/qr', requireRole('MANAGER'), validateCsrf, generateTripCheckInQr);
router.post('/:bookingId/board', requireRole('MANAGER'), validateCsrf, markPassengerBoarded);
router.post('/:bookingId/no-show', requireRole('MANAGER'), validateCsrf, markPassengerNoShow);

export default router;

