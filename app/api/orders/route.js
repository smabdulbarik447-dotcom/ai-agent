import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';
import { phoneRisk, normPhone } from '@/lib/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (req, _p, user) => {
  const st = req.nextUrl.searchParams.get('status') || '';
  const orders = await db.prepare(`SELECT * FROM orders WHERE user_id = ? AND (? = '' OR status = ?) ORDER BY id DESC LIMIT 500`).all(user.id, st, st);
  // phone history across every shop (counts only), to spot fake orders before shipping
  const risk = await phoneRisk(orders.map((o) => o.phone || '')).catch(() => ({}));
  return json(orders.map((o) => ({ ...o, risk: risk[normPhone(o.phone || '')] || null })));
});
