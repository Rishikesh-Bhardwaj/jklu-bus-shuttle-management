import { Router } from 'express';
import {
  listCorridors,
  createCorridor,
  listStops,
  createStop,
  listRoutes,
  getRouteById,
  createRoute,
} from '../controllers/routeController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Corridors
router.get('/corridors', listCorridors);
router.post('/corridors', requireRole('MANAGER'), validateCsrf, createCorridor);

// Stops
router.get('/stops', listStops);
router.post('/stops', requireRole('MANAGER'), validateCsrf, createStop);

// Routes
router.get('/', listRoutes);
router.get('/:id', getRouteById);
router.post('/', requireRole('MANAGER'), validateCsrf, createRoute);

export default router;

