import { db, getUserSettings, saveMessage } from './db.js';
import { sendText } from './facebook.js';

const STATUS_TEXT = {
  confirmed: (o) => `আপনার অর্ডার #${o.id} কনফার্ম হয়েছে ✅ মোট ৳${o.total}। খুব শীঘ্রই পাঠানো হবে।`,
  processing: (o) => `আপনার অর্ডার #${o.id} প্যাক করা হচ্ছে 📦`,
  shipped: (o) =>
    `আপনার অর্ডার #${o.id} কুরিয়ারে পাঠানো হয়েছে 🚚${o.tracking_code ? `\nট্র্যাকিং কোড: ${o.tracking_code}\nট্র্যাক করুন: https://steadfast.com.bd/t/${o.tracking_code}` : ''}\nডেলিভারির সময় ৳${o.total} পরিশোধ করবেন।`,
  delivered: (o) => `আপনার অর্ডার #${o.id} ডেলিভারি হয়েছে 🎉 আমাদের থেকে কেনার জন্য ধন্যবাদ! কোনো সমস্যা হলে জানাবেন।`,
  returned: () => null,
  cancelled: (o) => `আপনার অর্ডার #${o.id} বাতিল করা হয়েছে। কোনো প্রশ্ন থাকলে এখানে লিখুন।`,
};

/**
 * Tell the customer in Messenger that their order's status changed.
 * Returns { sent, reason } so the panel can show what happened.
 */
export async function notifyOrderStatus(userId, order) {
  const s = await getUserSettings(userId);
  if (s.notify_order_status !== '1') return { sent: false, reason: 'off' };
  const make = STATUS_TEXT[order.status];
  if (!make || !order.customer_id) return { sent: false, reason: 'no-customer' };
  const c = await db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(order.customer_id, userId);
  const page = c && (await db.prepare('SELECT * FROM pages WHERE page_id = ? AND user_id = ?').get(c.page_id, userId));
  if (!page) return { sent: false, reason: 'no-page' };
  const text = make(order);
  if (!text) return { sent: false, reason: 'no-text' };
  try {
    // Meta allows this tag for order/shipping updates, so it works after the 24-hour window too
    const ids = await sendText(page.access_token, c.psid, text, { tag: 'POST_PURCHASE_UPDATE' });
    await saveMessage(c.id, { mid: ids[0], direction: 'out', source: 'manual', text });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

/** Create the parcel at Steadfast Courier and save its tracking code. */
export async function sendToSteadfast(userId, order) {
  const s = await getUserSettings(userId);
  if (!s.steadfast_api_key || !s.steadfast_secret_key) throw new Error('Settings এ Steadfast API Key ও Secret Key দিন');
  if (!order.phone || !order.address) throw new Error('অর্ডারে ফোন নম্বর ও ঠিকানা নেই');
  const items = JSON.parse(order.items || '[]').map((i) => `${i.name} x${i.qty}`).join(', ');
  const res = await fetch('https://portal.packzy.com/api/v1/create_order', {
    method: 'POST',
    headers: { 'Api-Key': s.steadfast_api_key, 'Secret-Key': s.steadfast_secret_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice: `SP-${userId}-${order.id}`,
      recipient_name: order.customer_name || 'Customer',
      recipient_phone: String(order.phone).replace(/\D/g, '').slice(-11),
      recipient_address: order.address,
      cod_amount: Math.round(order.total || 0),
      note: items.slice(0, 250),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  const c = data.consignment;
  if (!res.ok || !c?.tracking_code) {
    throw new Error(`Steadfast: ${data.message || data.errors ? JSON.stringify(data.errors || data.message) : `HTTP ${res.status}`}`);
  }
  await db
    .prepare("UPDATE orders SET tracking_code = ?, consignment_id = ?, status = 'shipped' WHERE id = ? AND user_id = ?")
    .run(String(c.tracking_code), String(c.consignment_id ?? ''), order.id, userId);
  return { tracking_code: String(c.tracking_code) };
}
