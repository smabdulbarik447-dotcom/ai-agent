import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';
import { resolveImage, dropImage } from '@/lib/images';

export const runtime = 'nodejs';

const FIELDS = ['name', 'price', 'regular_price', 'stock_status', 'stock_qty', 'sku', 'category', 'description', 'url', 'image', 'active'];

export const PUT = guard(async (req, { id }, user) => {
  const old = await db.prepare('SELECT image FROM products WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!old) throw new Error('পাওয়া যায়নি');
  const b = await body(req);
  if ('image' in b) b.image = await resolveImage(user.id, b.image, req);
  const sets = FIELDS.filter((k) => k in b);
  if (!sets.length) throw new Error('কিছু পরিবর্তন নেই');
  (await db.prepare(`UPDATE products SET ${sets.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(...sets.map((k) => (b[k] === '' ? null : b[k])), id, user.id));
  if ('image' in b && (old.image || '') !== (b.image || '')) {
    await db.prepare('UPDATE products SET image_desc = NULL WHERE id = ?').run(id); // AI looks at the new photo again
    await dropImage(user.id, old.image);
  }
  return json((await db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, user.id)));
});

export const DELETE = guard(async (_req, { id }, user) => {
  const old = await db.prepare('SELECT image FROM products WHERE id = ? AND user_id = ?').get(id, user.id);
  (await db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(id, user.id));
  if (old) await dropImage(user.id, old.image);
  return json({ ok: true });
});
