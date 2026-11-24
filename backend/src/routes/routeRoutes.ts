import { Router } from 'express';
import {
  listCorridors,
  createCorridor,
  deleteCorridor,
  listStops,
  createStop,
  deleteStop,
  listRoutes,
  getRouteById,
  createRoute,
  deleteRoute,
} from '../controllers/routeController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Corridors
router.get('/corridors', listCorridors);
router.post('/corridors', requireRole('MANAGER'), validateCsrf, createCorridor);
router.delete('/corridors/:id', requireRole('MANAGER'), validateCsrf, deleteCorridor);

// Stops
router.get('/stops', listStops);
router.post('/stops', requireRole('MANAGER'), validateCsrf, createStop);
router.delete('/stops/:id', requireRole('MANAGER'), validateCsrf, deleteStop);

// Routes
router.get('/', listRoutes);
router.get('/:id', getRouteById);
router.post('/', requireRole('MANAGER'), validateCsrf, createRoute);
router.delete('/:id', requireRole('MANAGER'), validateCsrf, deleteRoute);

export default router;

