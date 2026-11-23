import { Router } from 'express';
import { getCsrfToken, register, login, logout, getMe } from '../controllers/authController.js';
import { authenticate, validateCsrf } from '../middleware/auth.js';

const router = Router();

// Public CSRF issuance
router.get('/csrf', getCsrfToken);

// Public Auth Endpoints (require CSRF token)
router.post('/register', validateCsrf, register);
router.post('/login', validateCsrf, login);

// Authenticated Auth Endpoints
router.post('/logout', authenticate, validateCsrf, logout);
router.get('/me', authenticate, getMe);

export default router;

