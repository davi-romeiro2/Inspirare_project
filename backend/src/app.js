// Express app wiring.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no Origin (curl, server-to-server) and the configured list.
      if (!origin || env.FRONTEND_ORIGIN.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/', (_req, res) => res.json({ name: 'inspirare-backend', ok: true }));
app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
