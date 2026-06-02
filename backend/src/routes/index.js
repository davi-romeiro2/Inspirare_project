// Top-level /api router. Mounts auth and a health check.

import { Router } from 'express';
import authRouter from './auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use('/auth', authRouter);

export default router;
