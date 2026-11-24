import { Router } from 'express';
import {
  listTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  returnServiceAuditCheck,
} from '../controllers/tripController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

// Trips listing can be accessed by authenticated users
router.use(authenticate);

router.get('/', listTrips);
// Return service audit endpoint (MANAGER only) - must precede /:id to prevent route shadowing
router.get('/audit/return-service-check', requireRole('MANAGER'), returnServiceAuditCheck);
router.get('/:id', getTripById);

// Scheduling trips (MANAGER only)
router.post('/', requireRole('MANAGER'), validateCsrf, createTrip);
router.put('/:id', requireRole('MANAGER'), validateCsrf, updateTrip);
router.delete('/:id', requireRole('MANAGER'), validateCsrf, deleteTrip);

export default router;

