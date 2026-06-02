// Authorization middleware: validates the Bearer token (delegates to requireAuth)
// and then checks the user's role against the allowlist.

import { requireAuth } from './requireAuth.js';
import { HttpError } from '../lib/errors.js';

/**
 * Returns an Express middleware array that requires an authenticated user
 * whose `profile.role` is in `allowedRoles`.
 *
 * @param  {...string} allowedRoles  e.g. 'admin', 'funcionario'
 * @returns {Array<Function>}         chain of middlewares
 */
export function requireRole(...allowedRoles) {
  return [
    requireAuth,
    (req, _res, next) => {
      if (!req.profile || !allowedRoles.includes(req.profile.role)) {
        return next(
          new HttpError(403, 'forbidden', 'Você não tem permissão para essa ação.')
        );
      }
      next();
    },
  ];
}
