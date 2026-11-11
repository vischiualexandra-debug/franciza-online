// Reguli pentru conturile echipei — rulează și în browser (formulare), și pe server.

export const ROLES = ['admin', 'member']; // admin = gestionează echipa; member = doar cereri
export const USER_STATUSES = ['pending', 'active', 'disabled'];

export const normEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

export function validateAccount({ name, email, password } = {}, { requirePassword = true } = {}) {
  const errors = {};
  const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  const e = normEmail(email);
  if (!n) errors.name = 'err_required';
  else if (n.length < 2 || n.length > 80) errors.name = 'err_name_short';
  if (!e) errors.email = 'err_required';
  else if (e.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) errors.email = 'err_email';
  if (requirePassword) {
    if (!password) errors.password = 'err_required';
    else if (password.length < 8) errors.password = 'err_pw_short';
    else if (password.length > 200) errors.password = 'err_too_long';
  }
  return { ok: Object.keys(errors).length === 0, errors, data: { name: n, email: e } };
}
