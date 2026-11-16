import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const PUT = guard(async (req, { id }, user) => {
  if (!(await db.prepare('SELECT 1 FROM knowledge WHERE id = ? AND user_id = ?').get(id, user.id))) throw new Error('পাওয়া যায়নি');
  const b = await body(req);
  const sets = [];
  const vals = [];
  if ('title' in b) { sets.push('title = ?'); vals.push(String(b.title).trim().slice(0, 300)); }
  if ('content' in b) { sets.push('content = ?'); vals.push(String(b.content).trim().slice(0, 4000)); }
  if ('active' in b) { sets.push('active = ?'); vals.push(b.active ? 1 : 0); }
  if (!sets.length) throw new Error('কিছু পরিবর্তন নেই');
  (await db.prepare(`UPDATE knowledge SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals, id, user.id));
  return json((await db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id)));
});

export const DELETE = guard(async (_req, { id }, user) => {
  (await db.prepare('DELETE FROM knowledge WHERE id = ? AND user_id = ?').run(id, user.id));
  return json({ ok: true });
});
