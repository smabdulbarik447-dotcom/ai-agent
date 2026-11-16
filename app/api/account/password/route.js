import { db } from '@/lib/db';
import { guard, json, body, hashPassword, verifyPassword } from '@/lib/api';

export const runtime = 'nodejs';

export const POST = guard(async (req, _p, user) => {
  const { current, next } = await body(req);
  if (!verifyPassword(String(current || ''), user.password_hash)) throw new Error('বর্তমান পাসওয়ার্ড ভুল');
  if (String(next || '').length < 6) throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
  (await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(next)), user.id));
  return json({ ok: true });
});
