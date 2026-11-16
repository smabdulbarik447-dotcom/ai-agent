import { db } from '@/lib/db';
import { json, body, verifyPassword, startSession, ensureAdmin } from '@/lib/api';

export const runtime = 'nodejs';

// `as` is "user" (the /login page) or "admin" (the /admin/login page); each only lets its own role in
export async function POST(req) {
  ensureAdmin();
  const { email, password, as = 'user' } = await body(req);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) return json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' }, 401);
  if (as === 'admin' && user.role !== 'admin') return json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' }, 401);
  if (as !== 'admin' && user.role === 'admin') return json({ error: 'অ্যাডমিন অ্যাকাউন্ট দিয়ে /admin/login থেকে লগইন করুন' }, 403);
  if (user.status !== 'active') return json({ error: 'আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। সাপোর্টে যোগাযোগ করুন।' }, 403);
  return startSession(json({ ok: true, role: user.role }), user.id);
}
