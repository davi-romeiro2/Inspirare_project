// Loads and validates environment variables. Fails fast on missing required vars.

import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`[env] Missing required environment variable: ${name}`);
    console.error(`[env] Copy backend/.env.example to backend/.env and fill in the values.`);
    process.exit(1);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

function optionalInt(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = Object.freeze({
  PORT: Number(optional('PORT', '3000')),
  NODE_ENV: optional('NODE_ENV', 'development'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_ANON_KEY: optional('SUPABASE_ANON_KEY', ''),
  FRONTEND_ORIGIN: optional('FRONTEND_ORIGIN', 'http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  JWT_SECRET: optional('JWT_SECRET', ''),

  // Resend (password reset). Vazio = modo dev: o codigo sai no console.
  RESEND_API_KEY: optional('RESEND_API_KEY', ''),
  RESEND_FROM_EMAIL: optional('RESEND_FROM_EMAIL', 'onboarding@resend.dev'),
  RESET_CODE_TTL_MINUTES: optionalInt('RESET_CODE_TTL_MINUTES', 10),
  RESET_MAX_ATTEMPTS: optionalInt('RESET_MAX_ATTEMPTS', 5),
});

export const RESEND_ENABLED = Boolean(env.RESEND_API_KEY);
