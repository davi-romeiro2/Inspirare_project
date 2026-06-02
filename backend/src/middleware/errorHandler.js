// Last-resort error handler. Always responds with JSON.
// In dev we include the stack; in prod we keep it minimal.

import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.code,
      ...(err.fields ? { fields: err.fields } : {}),
      ...(err.message ? { message: err.message } : {}),
    });
  }

  // Map common Supabase errors to friendly HTTP statuses
  const msg = err?.message || '';
  if (/already registered|already been registered/i.test(msg)) {
    return res.status(409).json({ error: 'user_already_exists' });
  }
  if (/Invalid login credentials/i.test(msg)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  if (/rate limit/i.test(msg)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  console.error('[errorHandler] unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    ...(env.NODE_ENV !== 'production' ? { message: msg, stack: err?.stack } : {}),
  });
}
