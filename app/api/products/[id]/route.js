import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

const FIELDS = ['name', 'price', 'regular_price', 'stock_status', 'stock_qty', 'sku', 'category', 'description', 'url', 'image', 'active'];

export const PUT = guard(async (req, { id }, user) => {
  if (!(await db.prepare('SELECT 1 FROM products WHERE id = ? AND user_id = ?').get(id, user.id))) throw new Error('পাওয়া যায়নি');
  const b = await body(req);
  const sets = FIELDS.filter((k) => k in b);
  if (!sets.length) throw new Error('কিছু পরিবর্তন নেই');
  (await db.prepare(`UPDATE products SET ${sets.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(...sets.map((k) => (b[k] === '' ? null : b[k])), id, user.id));
  return json((await db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, user.id)));
});

export const DELETE = guard(async (_req, { id }, user) => {
  (await db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(id, user.id));
  return json({ ok: true });
});
