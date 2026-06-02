// Auth routes: signup, login, me.

import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { validateSignup, validateLogin } from '../lib/validators.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/requireAuth.js';

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

export default router;
