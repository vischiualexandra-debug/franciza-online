import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

// Toate operațiile cu baza de date rulează DOAR pe server, cu cheia secretă Supabase
// (din variabilele de mediu Vercel). Browserul nu primește niciodată cheia.
//
// Local, fără SUPABASE_URL, se folosesc fișiere de test în .data/*.json,
// ca să poți lucra la design fără cont Supabase. Pe Vercel Supabase e obligatoriu.

const LEADS = 'leads';
const USERS = 'admin_users';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let client;
function supabase() {
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function dbMode() {
  if (url && key) return 'supabase';
  if (process.env.VERCEL) {
    throw new Error('SUPABASE_URL și SUPABASE_SECRET_KEY lipsesc din variabilele de mediu Vercel.');
  }
  return 'local';
}

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// ---------- fallback local (doar pentru dezvoltare) ----------
const localFile = (table) => path.join(process.cwd(), '.data', `${table}.json`);
async function readLocal(table) {
  try {
    return JSON.parse(await fs.readFile(localFile(table), 'utf8'));
  } catch {
    return [];
  }
}
async function writeLocal(table, rows) {
  await fs.mkdir(path.dirname(localFile(table)), { recursive: true });
  await fs.writeFile(localFile(table), JSON.stringify(rows, null, 2));
}
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

// =============================== CERERI ===============================

// lead = datele validate din lib/form.js + lang, source, utm
export async function insertLead(lead) {
  if (dbMode() === 'supabase') {
    return must(await supabase().from(LEADS).insert({ ...lead, status: 'new' }).select().single());
  }
  const rows = await readLocal(LEADS);
  const row = { id: nextId(rows), created_at: new Date().toISOString(), updated_at: null, ...lead, status: 'new' };
  rows.push(row);
  await writeLocal(LEADS, rows);
  return row;
}

export async function listLeads() {
  if (dbMode() === 'supabase') {
    return must(await supabase().from(LEADS).select('*').order('created_at', { ascending: false }).limit(1000));
  }
  const rows = await readLocal(LEADS);
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function updateLeadStatus(id, status, updatedBy = null) {
  const patch = { status, updated_at: new Date().toISOString(), updated_by: updatedBy };
  if (dbMode() === 'supabase') {
    return must(await supabase().from(LEADS).update(patch).eq('id', id).select().maybeSingle());
  }
  const rows = await readLocal(LEADS);
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  await writeLocal(LEADS, rows);
  return row;
}

// =============================== CONTURI ===============================
// Câmpurile care pleacă spre browser (fără hash-ul parolei).
const USER_PUBLIC = 'id, created_at, email, name, role, status, approved_by, last_login';
const strip = (u) => {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
};

export async function getUserByEmail(email) {
  if (dbMode() === 'supabase') {
    return must(await supabase().from(USERS).select('*').eq('email', email).maybeSingle());
  }
  return (await readLocal(USERS)).find((u) => u.email === email) || null;
}

export async function getUserById(id) {
  if (dbMode() === 'supabase') {
    return must(await supabase().from(USERS).select('*').eq('id', id).maybeSingle());
  }
  return (await readLocal(USERS)).find((u) => u.id === id) || null;
}

export async function countActiveAdmins() {
  if (dbMode() === 'supabase') {
    const { count, error } = await supabase()
      .from(USERS)
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return count || 0;
  }
  return (await readLocal(USERS)).filter((u) => u.role === 'admin' && u.status === 'active').length;
}

export async function createUser(user) {
  if (dbMode() === 'supabase') {
    return strip(must(await supabase().from(USERS).insert(user).select().single()));
  }
  const rows = await readLocal(USERS);
  if (rows.some((u) => u.email === user.email)) throw new Error('duplicate key value (email)');
  const row = { id: nextId(rows), created_at: new Date().toISOString(), last_login: null, approved_by: null, ...user };
  rows.push(row);
  await writeLocal(USERS, rows);
  return strip(row);
}

export async function listUsers() {
  if (dbMode() === 'supabase') {
    return must(await supabase().from(USERS).select(USER_PUBLIC).order('created_at', { ascending: true }));
  }
  return (await readLocal(USERS)).map(strip);
}

export async function updateUser(id, patch) {
  if (dbMode() === 'supabase') {
    return strip(must(await supabase().from(USERS).update(patch).eq('id', id).select().maybeSingle()));
  }
  const rows = await readLocal(USERS);
  const row = rows.find((u) => u.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  await writeLocal(USERS, rows);
  return strip(row);
}

export async function deleteUser(id) {
  if (dbMode() === 'supabase') {
    must(await supabase().from(USERS).delete().eq('id', id));
    return true;
  }
  const rows = await readLocal(USERS);
  await writeLocal(USERS, rows.filter((u) => u.id !== id));
  return true;
}
