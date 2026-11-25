import { Router } from 'express';
import { authenticate, requireRole, validateCsrf } from '../middleware/auth.js';
import { deleteResource, updateResourceStatus } from '../controllers/resourceLifecycleController.js';

const router = Router();
router.use(authenticate);
router.patch('/:type/:id/status', requireRole('MANAGER'), validateCsrf, updateResourceStatus);
router.delete('/:type/:id', requireRole('MANAGER'), validateCsrf, deleteResource);
export default router;
