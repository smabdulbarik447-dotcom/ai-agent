import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from './db.js';

export const SESSION_COOKIE = 'sp_session';
const SESSION_DAYS = 30;

export const json = (data, status = 200) => NextResponse.json(data, { status });

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------
// Passwords & sessions
// ------------------------------------------------------------------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).run(token, userId);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 });
  return res;
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now')`
      )
      .get(token) || null
  );
}

export async function endSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// First run: create the super admin from .env
export function ensureAdmin() {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare("INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin', 'admin')").run(email, hashPassword(pw));
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
}

/**
 * Wrap an API route handler: requires a logged-in user (or admin with
 * { admin: true }) and turns thrown errors into `{ error }` JSON.
 * The handler receives (req, params, user).
 */
export function guard(handler, { admin = false } = {}) {
  return async (req, ctx) => {
    const user = await currentUser();
    if (!user) return json({ error: 'login required' }, 401);
    if (user.status !== 'active') return json({ error: 'আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। সাপোর্টে যোগাযোগ করুন।' }, 403);
    if (admin && user.role !== 'admin') return json({ error: 'শুধু অ্যাডমিনের জন্য' }, 403);
    try {
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, params, user);
    } catch (e) {
      return json({ error: e.message }, 400);
    }
  };
}

export function publicUrl(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
