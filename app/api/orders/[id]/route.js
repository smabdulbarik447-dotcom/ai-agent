import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

const STATUSES = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export const PUT = guard(async (req, { id }, user) => {
  const { status } = await body(req);
  if (!STATUSES.includes(status)) throw new Error('ভুল স্ট্যাটাস');
  (await db.prepare('UPDATE orders SET status = ? WHERE id = ? AND user_id = ?').run(status, id, user.id));
  return json({ ok: true });
});
