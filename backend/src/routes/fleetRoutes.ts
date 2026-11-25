import { Router } from 'express';
import {
  listBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
  listDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from '../controllers/fleetController.js';
import { deleteResource } from '../controllers/resourceLifecycleController.js';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';

const router = Router();

// Fleet listing can be viewed by authenticated users
router.use(authenticate);

// Buses
router.get('/buses', listBuses);
router.get('/buses/:id', getBusById);
router.post('/buses', requireRole('MANAGER'), validateCsrf, createBus);
router.put('/buses/:id', requireRole('MANAGER'), validateCsrf, updateBus);
router.delete('/buses/:id', requireRole('MANAGER'), validateCsrf, (req, res) => { req.params.type = 'bus'; return deleteResource(req, res); });

// Drivers
router.get('/drivers', listDrivers);
router.post('/drivers', requireRole('MANAGER'), validateCsrf, createDriver);
router.put('/drivers/:id', requireRole('MANAGER'), validateCsrf, updateDriver);
router.delete('/drivers/:id', requireRole('MANAGER'), validateCsrf, (req, res) => { req.params.type = 'driver'; return deleteResource(req, res); });

export default router;

