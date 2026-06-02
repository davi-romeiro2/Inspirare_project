// Small inline validators. We keep these in plain JS for v1 to avoid a dependency.
// Swap for zod/joi when validation grows.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_SPECIAL = /[@#$%&*]/;

export function validateSignup(body) {
  const errors = {};
  const fullname = (body?.fullname ?? '').trim();
  const email = (body?.email ?? '').trim().toLowerCase();
  const phoneRaw = (body?.phone ?? '').toString();
  const password = (body?.password ?? '').toString();
  const phoneDigits = phoneRaw.replace(/\D/g, '');

  if (fullname.length < 2 || fullname.length > 120) {
    errors.fullname = 'must be between 2 and 120 characters';
  }
  if (!EMAIL_RE.test(email)) {
    errors.email = 'invalid';
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = 'must contain 10-11 digits';
  }
  if (password.length < 8) {
    errors.password = 'must be at least 8 characters';
  } else if (!/[A-Z]/.test(password)) {
    errors.password = 'must contain an uppercase letter';
  } else if (!/[0-9]/.test(password)) {
    errors.password = 'must contain a digit';
  } else if (!PASSWORD_SPECIAL.test(password)) {
    errors.password = 'must contain one of @#$%&*';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { fullname, email, phone: phoneRaw.trim(), phoneDigits, password },
  };
}

export function validateLogin(body) {
  const errors = {};
  const email = (body?.email ?? '').trim().toLowerCase();
  const password = (body?.password ?? '').toString();

  if (!EMAIL_RE.test(email)) errors.email = 'invalid';
  if (password.length === 0) errors.password = 'required';

  return { ok: Object.keys(errors).length === 0, errors, data: { email, password } };
}
