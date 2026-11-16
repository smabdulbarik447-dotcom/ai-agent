import { db, upsertProduct } from '@/lib/db';
import { checkLimit } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (req, _p, user) => {
  const sp = req.nextUrl.searchParams;
  const q = `%${(sp.get('q') || '').toLowerCase()}%`;
  const stock = sp.get('stock') || '';
  return json(
    (await db
      .prepare(
        `SELECT * FROM products WHERE user_id = ? AND (lower(name) LIKE ? OR lower(IFNULL(category,'')) LIKE ? OR lower(IFNULL(sku,'')) LIKE ?)
         AND (? = '' OR stock_status = ?) ORDER BY updated_at DESC LIMIT 500`
      )
      .all(user.id, q, q, q, stock, stock))
  );
});

export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  if (!b.name) throw new Error('নাম দিন');
  (await checkLimit(user.id, 'products'));
  const id = (await upsertProduct(user.id, { ...b, source: 'manual', source_key: null }));
  if (b.active === 0) (await db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id));
  return json((await db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
});
