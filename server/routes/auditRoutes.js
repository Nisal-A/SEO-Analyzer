import { Router } from 'express';
import { analyzeRateLimiter } from '../middleware/rateLimiters.js';
import { clientIdentity } from '../middleware/clientIdentity.js';
import { requireAdminKey } from '../middleware/requireAdminKey.js';
import { validateAnalyzeRequest } from '../middleware/validateAnalyzeRequest.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import {
  analyzeUrl,
  getAudits,
  getAudit,
  getStats,
  deleteAudit,
} from '../controllers/auditController.js';

const router = Router();

router.use(clientIdentity);

router.post('/analyze', analyzeRateLimiter, validateAnalyzeRequest, analyzeUrl);
// Registered before '/:id' so "stats" is never treated as an ObjectId.
router.get('/stats', getStats);
// Audit history listing and deletion are admin-only (X-Admin-Key).
router.get('/', requireAdminKey, getAudits);
router.get('/:id', validateObjectId, getAudit);
router.delete('/:id', requireAdminKey, validateObjectId, deleteAudit);

export default router;
