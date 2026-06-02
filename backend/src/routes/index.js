// Top-level /api router. Mounts auth, plans and a health check.

import { Router } from 'express';
import authRouter from './auth.js';
import plansRouter from './plans.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/plans', plansRouter);

export default router;
