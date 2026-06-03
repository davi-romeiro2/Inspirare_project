// Top-level /api router. Mounts auth, plans, appointments and a health check.

import { Router } from 'express';
import authRouter from './auth.js';
import plansRouter from './plans.js';
import appointmentsRouter from './appointments.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/plans', plansRouter);
router.use('/appointments', appointmentsRouter);

export default router;
