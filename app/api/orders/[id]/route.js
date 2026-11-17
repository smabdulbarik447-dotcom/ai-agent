import { db } from '@/lib/db';
import { notifyOrderStatus } from '@/lib/orders';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

const STATUSES = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

// Change status; the customer gets a Messenger update when that's turned on
export const PUT = guard(async (req, { id }, user) => {
  const { status } = await body(req);
  if (!STATUSES.includes(status)) throw new Error('ভুল স্ট্যাটাস');
  const before = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!before) throw new Error('অর্ডার পাওয়া যায়নি');
  await db.prepare('UPDATE orders SET status = ? WHERE id = ? AND user_id = ?').run(status, id, user.id);
  const notify = before.status === status ? { sent: false } : await notifyOrderStatus(user.id, { ...before, status });
  return json({ ok: true, notified: notify.sent });
});
