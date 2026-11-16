import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

const FIELDS = ['name', 'keywords', 'match_type', 'reply', 'priority', 'active'];

export const PUT = guard(async (req, { id }, user) => {
  if (!db.prepare('SELECT 1 FROM rules WHERE id = ? AND user_id = ?').get(id, user.id)) throw new Error('পাওয়া যায়নি');
  const b = await body(req);
  const sets = FIELDS.filter((k) => k in b);
  if (!sets.length) throw new Error('কিছু পরিবর্তন নেই');
  db.prepare(`UPDATE rules SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...sets.map((k) => (k === 'active' ? (b[k] ? 1 : 0) : k === 'priority' ? Number(b[k]) || 0 : b[k])), id, user.id);
  return json(db.prepare('SELECT * FROM rules WHERE id = ? AND user_id = ?').get(id, user.id));
});

export const DELETE = guard((_req, { id }, user) => {
  db.prepare('DELETE FROM rules WHERE id = ? AND user_id = ?').run(id, user.id);
  return json({ ok: true });
});
