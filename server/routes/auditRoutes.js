import { Router } from 'express';
import { analyzeRateLimiter } from '../middleware/rateLimiters.js';
import { clientIdentity } from '../middleware/clientIdentity.js';
import { validateAnalyzeRequest } from '../middleware/validateAnalyzeRequest.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import {
  analyzeUrl,
  getAudits,
  getAudit,
  deleteAudit,
} from '../controllers/auditController.js';

const router = Router();

router.use(clientIdentity);

router.post('/analyze', analyzeRateLimiter, validateAnalyzeRequest, analyzeUrl);
router.get('/', getAudits);
router.get('/:id', validateObjectId, getAudit);
router.delete('/:id', validateObjectId, deleteAudit);

export default router;
