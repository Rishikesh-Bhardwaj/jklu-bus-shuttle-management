import { Router } from 'express';
import {
  createBooking,
  cancelBooking,
  getMyBookings,
  getBookingById,
} from '../controllers/bookingController.js';
import { authenticate, requireVerified, validateCsrf } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// List user's own bookings
router.get('/my', getMyBookings);

// Get single booking / boarding pass
router.get('/:id', getBookingById);

// Create booking (strictly requires verified affiliation and CSRF validation)
router.post('/', requireVerified, validateCsrf, createBooking);

// Cancel booking (requires CSRF validation)
router.post('/:id/cancel', validateCsrf, cancelBooking);

export default router;

