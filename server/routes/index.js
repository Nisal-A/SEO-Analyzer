import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import auditRoutes from './auditRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/audits', auditRoutes);

export default router;
