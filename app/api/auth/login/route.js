import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { json, body, verifyPassword, startSession, ensureAdmin } from '@/lib/api';

export const runtime = 'nodejs';

const sameText = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// `as` is "user" (the /login page: email + password) or "admin" (the /admin/login page: password only)
export async function POST(req) {
  await ensureAdmin();
  const { email, password, as = 'user' } = await body(req);

  if (as === 'admin') {
    // The admin password is ADMIN_PASSWORD (env), so it can be changed from the hosting panel
    if (!sameText(password || '', process.env.ADMIN_PASSWORD || 'admin123')) return json({ error: 'পাসওয়ার্ড ভুল' }, 401);
    const admin = await db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    return startSession(json({ ok: true, role: 'admin' }), admin.id);
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) return json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' }, 401);
  if (user.role === 'admin') return json({ error: 'অ্যাডমিন হিসেবে /admin/login থেকে লগইন করুন' }, 403);
  if (user.status !== 'active') return json({ error: 'আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। সাপোর্টে যোগাযোগ করুন।' }, 403);
  return startSession(json({ ok: true, role: user.role }), user.id);
}
