import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { guard, json, startSession, SESSION_COOKIE, ADMIN_BACK_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';

// Support: open a user's dashboard exactly as they see it. The admin session is kept aside to come back to.
export const POST = guard(async (_req, { id }) => {
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) throw new Error('ইউজার পাওয়া যায়নি');
  if (target.role === 'admin') throw new Error('অ্যাডমিন অ্যাকাউন্টে এভাবে ঢোকা যায় না');
  const adminToken = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await startSession(json({ ok: true }), target.id, { days: 1 });
  res.cookies.set(ADMIN_BACK_COOKIE, adminToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400 });
  return res;
}, { admin: true });
