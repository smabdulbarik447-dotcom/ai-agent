import { db } from '@/lib/db';
import { planValues } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const PUT = guard(async (req, { id }) => {
  const v = planValues(await body(req));
  const keys = Object.keys(v);
  if (!keys.length) throw new Error('কিছু পরিবর্তন নেই');
  if (v.slug && db.prepare('SELECT 1 FROM plans WHERE slug = ? AND id != ?').get(v.slug, id)) throw new Error('এই slug এর প্ল্যান আগেই আছে');
  db.prepare(`UPDATE plans SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => v[k]), id);
  return json({ ok: true });
}, { admin: true });

// Plans that were ever sold are hidden instead of deleted
export const DELETE = guard((_req, { id }) => {
  const used = db.prepare('SELECT 1 FROM subscriptions WHERE plan_id = ? UNION SELECT 1 FROM payments WHERE plan_id = ?').get(id, id);
  if (used) db.prepare('UPDATE plans SET active = 0 WHERE id = ?').run(id);
  else db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  return json({ ok: true, hidden: !!used });
}, { admin: true });
