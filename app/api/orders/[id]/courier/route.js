import { db } from '@/lib/db';
import { notifyOrderStatus, sendToSteadfast } from '@/lib/orders';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';

// Book the parcel at Steadfast; the order becomes "shipped" and the customer gets the tracking code
export const POST = guard(async (_req, { id }, user) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!order) throw new Error('অর্ডার পাওয়া যায়নি');
  if (order.tracking_code) throw new Error(`এই অর্ডার আগেই কুরিয়ারে দেওয়া হয়েছে (ট্র্যাকিং: ${order.tracking_code})`);
  const { tracking_code } = await sendToSteadfast(user.id, order);
  const notify = await notifyOrderStatus(user.id, { ...order, status: 'shipped', tracking_code });
  return json({ ok: true, tracking_code, notified: notify.sent });
});
