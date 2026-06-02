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

// Regras de senha forte mantidas em sync com validateSignup e com
// forgot-password/index.html (cliente). Se voce mexer em uma, mexa nas tres.
function _validateStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) return 'must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'must contain a digit';
  if (!PASSWORD_SPECIAL.test(password)) return 'must contain one of @#$%&*';
  return null;
}

export function validateForgotIdentifier(body) {
  const errors = {};
  const identifier = (body?.identifier ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(identifier)) errors.identifier = 'invalid email';
  return { ok: Object.keys(errors).length === 0, errors, data: { identifier } };
}

export function validateForgotVerify(body) {
  const errors = {};
  const identifier = (body?.identifier ?? '').trim().toLowerCase();
  const code = (body?.code ?? '').toString();
  if (!EMAIL_RE.test(identifier)) errors.identifier = 'invalid email';
  if (!/^\d{6}$/.test(code)) errors.code = 'must be 6 digits';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { identifier, code },
  };
}

export function validateResetPassword(body) {
  const errors = {};
  const resetToken = (body?.resetToken ?? '').toString().trim();
  const newPassword = (body?.newPassword ?? '').toString();
  if (!resetToken) errors.resetToken = 'required';
  const pwErr = _validateStrongPassword(newPassword);
  if (pwErr) errors.newPassword = pwErr;
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { resetToken, newPassword },
  };
}
