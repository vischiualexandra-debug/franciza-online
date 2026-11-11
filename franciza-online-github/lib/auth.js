import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getUserById } from './db';

// Sesiune: cookie httpOnly semnat cu HMAC (AUTH_SECRET), care conține id-ul contului.
// La fiecare cerere verificăm în baza de date că contul există și e activ —
// așa un cont dezactivat pierde accesul imediat.
//
// ADMIN_PASSWORD (din Vercel) servește doar la PRIMA intrare: cât timp nu există niciun
// administrator, cine intră cu emailul său + ADMIN_PASSWORD devine administratorul principal.

export const COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 zile

// Valorile de rezervă de mai jos funcționează DOAR la `npm run dev` pe calculatorul tău.
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (isProd) throw new Error('AUTH_SECRET lipsește sau e prea scurt (minim 16 caractere).');
  return 'dev-only-secret-change-me-please';
}

const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---------- parole (scrypt, cu sare aleatoare) ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [v, saltHex, hashHex] = stored.split('$');
  if (v !== 's1' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), 64);
  return safeEqual(hash.toString('hex'), hashHex);
}

// Parola de pornire (doar pentru crearea primului administrator)
export function checkBootstrapPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || (isProd ? '' : 'admin12345');
  if (!expected) return false;
  const h = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
  return safeEqual(h(password), h(expected));
}

// ---------- cookie ----------
export function createSessionValue(userId) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `u${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function readSession(value) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [who, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${who}.${exp}`))) return null;
  if (!(Number(exp) > Date.now() / 1000)) return null;
  const id = Number(who.slice(1));
  return who.startsWith('u') && Number.isInteger(id) ? id : null;
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE,
};

// Contul logat (activ) sau null. Nu întoarce niciodată hash-ul parolei.
export async function currentUser() {
  const store = await cookies();
  const id = readSession(store.get(COOKIE)?.value);
  if (!id) return null;
  const user = await getUserById(id).catch(() => null);
  if (!user || user.status !== 'active') return null;
  const { password_hash, ...safe } = user;
  return safe;
}

export async function isAdmin() {
  return !!(await currentUser());
}
