// Auth routes: signup, login, me, forgot/verify/reset.

import { Router } from 'express';
import crypto from 'node:crypto';
import { supabase } from '../services/supabase.js';
import {
  validateSignup,
  validateLogin,
  validateForgotIdentifier,
  validateForgotVerify,
  validateResetPassword,
} from '../lib/validators.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendEmail, renderResetCodeEmail } from '../services/resend.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * POST /api/auth/signup
 * Body: { fullname, email, phone, password }
 * 201 -> { user, session, profile }
 */
router.post('/signup', async (req, res, next) => {
  try {
    console.log('[signup] received body keys:', Object.keys(req.body || {}));
    const v = validateSignup(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid signup payload', v.errors);
    const { fullname, email, phone, password } = v.data;
    console.log('[signup] validated, calling supabase.auth.admin.createUser for', email);

    // 1) Create auth user (auto-confirm in v1 — toggle when SMTP is wired).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullname, phone },
    });
    console.log('[signup] createUser returned. err:', createErr?.message, 'user:', created?.user?.id);
    if (createErr || !created?.user) {
      // Surface duplicate-email cleanly
      if (createErr && /already registered/i.test(createErr.message)) {
        throw new HttpError(409, 'user_already_exists', 'This email is already registered');
      }
      throw new HttpError(500, 'signup_failed', createErr?.message || 'Could not create user');
    }
    const user = created.user;

    // 2) Upsert profile (the trigger handle_new_user is the safety net).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, fullname, phone, role: 'user' }, { onConflict: 'id' })
      .select('id, fullname, phone, role, created_at, updated_at')
      .single();
    if (profileErr) {
      console.error('[signup] profile upsert failed (user was created):', profileErr);
    }

    // 3) Issue a session so the client can store the token immediately.
    const { data: signin, error: signinErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signinErr || !signin?.session) {
      // Account exists but no session yet (e.g. email confirmation required).
      // Return 201 with user + profile but null session; client can route to login.
      return res.status(201).json({
        user: { id: user.id, email: user.email },
        session: null,
        profile: profile || null,
      });
    }

    return res.status(201).json({
      user: { id: user.id, email: user.email },
      session: {
        access_token: signin.session.access_token,
        refresh_token: signin.session.refresh_token,
        expires_in: signin.session.expires_in,
        token_type: signin.session.token_type,
      },
      profile: profile || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * 200 -> { user, session, profile }
 */
router.post('/login', async (req, res, next) => {
  try {
    const v = validateLogin(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid login payload', v.errors);
    const { email, password } = v.data;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user || !data?.session) {
      throw new HttpError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, fullname, phone, role, created_at, updated_at')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[login] profile lookup failed:', profileErr);
    }

    return res.status(200).json({
      user: { id: data.user.id, email: data.user.email },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      profile: profile || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Requires Authorization: Bearer <access_token>
 * 200 -> { user, profile }
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: req.profile,
  });
});

// --- Password reset (custom 6-digit code flow) -----------------------------
//
// The supabase-js admin client does not expose getUserByEmail (>= 2.45), so we
// list users and filter on the server. We cap the scan at MAX_USER_SCAN_PAGES
// pages of MAX_USER_SCAN_PER_PAGE to avoid runaway calls.

const MAX_USER_SCAN_PAGES = 5;
const MAX_USER_SCAN_PER_PAGE = 1000;

async function findUserIdByEmail(email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= MAX_USER_SCAN_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: MAX_USER_SCAN_PER_PAGE,
    });
    if (error) throw new HttpError(500, 'user_lookup_failed', error.message);
    const users = data?.users || [];
    const match = users.find(
      (u) => (u.email || '').toLowerCase() === target
    );
    if (match) return match;
    if (users.length < MAX_USER_SCAN_PER_PAGE) return null; // last page
  }
  return null;
}

function hashCode(code, salt) {
  return crypto.createHash('sha256').update(code + salt).digest('hex');
}

function generateCode() {
  // 6 digits, zero-padded.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * POST /api/auth/forgot
 * Body: { identifier }   (e-mail)
 * Always returns 200 { ok: true } to avoid e-mail enumeration. Internally:
 *   - looks up the user
 *   - creates a row in password_reset_codes (hash + salt + 10min ttl)
 *   - sends the code via Resend (or logs it in dev)
 */
router.post('/forgot', async (req, res, next) => {
  try {
    const v = validateForgotIdentifier(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid payload', v.errors);
    const { identifier } = v.data;

    const userId = await findUserIdByEmail(identifier);
    if (!userId) {
      // Do NOT leak that the e-mail does not exist.
      console.log(`[forgot] no user matched: ${identifier}`);
      return res.json({ ok: true });
    }

    const code = generateCode();
    const salt = generateSalt();
    const codeHash = hashCode(code, salt);
    const expiresAt = new Date(
      Date.now() + env.RESET_CODE_TTL_MINUTES * 60_000
    ).toISOString();

    const { error: insertErr } = await supabase
      .from('password_reset_codes')
      .insert({
        user_id: userId.id,
        code_hash: codeHash,
        salt,
        expires_at: expiresAt,
      });
    if (insertErr) {
      console.error('[forgot] insert failed:', insertErr);
      // Still 200 ok — don't leak DB issues to the client.
      return res.json({ ok: true });
    }

    const ttlMin = env.RESET_CODE_TTL_MINUTES;
    try {
      const { subject, html, text } = renderResetCodeEmail({
        code,
        ttlMinutes: ttlMin,
      });
      await sendEmail({ to: identifier, subject, html, text });
    } catch (e) {
      console.error('[forgot] email send failed:', e?.message || e);
      // We don't surface this to the client (avoid info leak); user simply
      // won't get the e-mail and can retry. The row stays in the table until
      // it expires / is cleaned up.
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot/verify
 * Body: { identifier, code }
 * 200 -> { ok: true, resetToken }   (resetToken = id of the codes row, used by /reset)
 * 400 -> invalid_or_expired_code
 */
router.post('/forgot/verify', async (req, res, next) => {
  try {
    const v = validateForgotVerify(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid payload', v.errors);
    const { identifier, code } = v.data;

    const userId = await findUserIdByEmail(identifier);
    if (!userId) throw new HttpError(400, 'invalid_or_expired_code', 'Código inválido ou expirado.');

    // Pull the most recent active code row for this user.
    const { data: row, error: fetchErr } = await supabase
      .from('password_reset_codes')
      .select('id, user_id, code_hash, salt, expires_at, used_at, attempt_count')
      .eq('user_id', userId.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('[forgot/verify] lookup failed:', fetchErr);
      throw new HttpError(500, 'verify_failed', 'Could not verify code');
    }
    if (!row) throw new HttpError(400, 'invalid_or_expired_code', 'Código inválido ou expirado.');

    // Rate limit: too many bad attempts invalidates the code entirely.
    if (row.attempt_count >= env.RESET_MAX_ATTEMPTS) {
      await supabase
        .from('password_reset_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', row.id);
      throw new HttpError(400, 'invalid_or_expired_code', 'Código inválido ou expirado.');
    }

    const candidate = hashCode(code, row.salt);
    if (candidate !== row.code_hash) {
      // Always increment, even if it was already at limit-1 (we just invalidated
      // it above; this attempt pushes attempt_count one more time, which is fine).
      await supabase
        .from('password_reset_codes')
        .update({ attempt_count: row.attempt_count + 1 })
        .eq('id', row.id);
      throw new HttpError(400, 'invalid_or_expired_code', 'Código inválido ou expirado.');
    }

    // Success. We do NOT mark used_at here — the /reset call will, after it
    // actually changes the password. Returning the row id is safe: it's a
    // uuid v4 (122 bits entropy) and only valid while used_at is null and
    // expires_at is in the future.
    return res.json({ ok: true, resetToken: row.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset
 * Body: { resetToken, newPassword }
 * 200 -> { ok: true }
 * 400 -> invalid_or_expired_token
 */
router.post('/reset', async (req, res, next) => {
  try {
    const v = validateResetPassword(req.body);
    if (!v.ok) throw new HttpError(400, 'validation_error', 'Invalid payload', v.errors);
    const { resetToken, newPassword } = v.data;

    const { data: row, error: fetchErr } = await supabase
      .from('password_reset_codes')
      .select('id, user_id, expires_at, used_at')
      .eq('id', resetToken)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (fetchErr) {
      console.error('[reset] lookup failed:', fetchErr);
      throw new HttpError(500, 'reset_failed', 'Could not reset password');
    }
    if (!row) throw new HttpError(400, 'invalid_or_expired_token', 'Token inválido ou expirado.');

    // Change the password via admin API.
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      row.user_id,
      { password: newPassword }
    );
    if (updateErr) {
      console.error('[reset] updateUserById failed:', updateErr);
      throw new HttpError(500, 'reset_failed', 'Could not reset password');
    }

    // Mark the code as used. We don't fail the request if this update trips —
    // the user already has the new password; the worst case is a stale row
    // that the next cleanup will delete.
    const { error: markErr } = await supabase
      .from('password_reset_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id);
    if (markErr) console.error('[reset] mark used failed (non-fatal):', markErr);

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
