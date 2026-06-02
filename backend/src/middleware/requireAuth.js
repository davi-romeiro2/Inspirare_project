// Verifies the Bearer access token using the Supabase admin client.
// Populates req.user and req.profile on success.

import { supabase } from '../services/supabase.js';
import { HttpError } from '../lib/errors.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || req.get('Authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, 'missing_token', 'Missing or malformed Authorization header');

    const token = match[1].trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, 'invalid_token', 'Invalid or expired token');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, fullname, phone, role, created_at, updated_at')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[requireAuth] profile lookup failed:', profileError);
    }

    req.user = data.user;
    req.profile = profile || null;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}
