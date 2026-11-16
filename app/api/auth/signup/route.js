import { db, saveUserSettings, seedUser } from '@/lib/db';
import { json, body, hashPassword, startSession, ensureAdmin } from '@/lib/api';
import { startTrial } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(req) {
  ensureAdmin();
  const b = await body(req);
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const business = String(b.business_name || '').trim();
  if (!name || !business) return json({ error: 'নাম ও ব্যবসার নাম দিন' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'সঠিক ইমেইল দিন' }, 400);
  if (String(b.password || '').length < 6) return json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' }, 400);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return json({ error: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে' }, 400);

  const r = db
    .prepare('INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)')
    .run(email, hashPassword(String(b.password)), name, String(b.phone || '').trim());
  const userId = Number(r.lastInsertRowid);
  saveUserSettings(userId, { business_name: business });
  seedUser(userId);
  startTrial(userId);
  return startSession(json({ ok: true }), userId);
}
