import { db } from '@/lib/db';
import { checkLimit } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard((_req, _p, user) =>
  json(db.prepare('SELECT * FROM rules WHERE user_id = ? ORDER BY priority DESC, id ASC').all(user.id))
);

export const POST = guard(async (req, _p, user) => {
  const { name = '', keywords, match_type = 'contains', reply, priority = 0, active = true } = await body(req);
  if (!keywords || !reply) throw new Error('কীওয়ার্ড ও রিপ্লাই দুটোই দিন');
  checkLimit(user.id, 'rules');
  const r = db
    .prepare('INSERT INTO rules (user_id, name, keywords, match_type, reply, priority, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, name, keywords, match_type, reply, Number(priority) || 0, active ? 1 : 0);
  return json(db.prepare('SELECT * FROM rules WHERE id = ?').get(r.lastInsertRowid));
});
