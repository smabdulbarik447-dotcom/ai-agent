import { db } from '@/lib/db';
import { getPlans, planValues } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async () => json((await getPlans({ all: true }))), { admin: true });

export const POST = guard(async (req) => {
  const v = planValues(await body(req));
  if (!v.name) throw new Error('প্ল্যানের নাম দিন');
  v.slug ||= v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if ((await db.prepare('SELECT 1 FROM plans WHERE slug = ?').get(v.slug))) throw new Error('এই slug এর প্ল্যান আগেই আছে');
  const keys = Object.keys(v);
  (await db.prepare(`INSERT INTO plans (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => v[k])));
  return json({ ok: true });
}, { admin: true });
