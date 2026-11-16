import { db, saveMessage } from '@/lib/db';
import { decideReply, testCustomer } from '@/lib/agent';
import { activeSubscription } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lets the shop owner chat with their agent from the panel without Facebook
export const GET = guard((_req, _p, user) => {
  const c = testCustomer(user.id);
  return json(db.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY id ASC').all(c.id));
});

export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  const customer = testCustomer(user.id);
  if (b.reset) {
    db.prepare('DELETE FROM messages WHERE customer_id = ?').run(customer.id);
    return json({ ok: true });
  }
  const text = String(b.text || '').trim();
  if (!text) throw new Error('মেসেজ লিখুন');
  if (!activeSubscription(user.id)) throw new Error('বট চালাতে একটি প্ল্যান লাগবে — Billing থেকে প্ল্যান কিনুন।');
  saveMessage(customer.id, { direction: 'in', source: 'customer', text });
  const reply = await decideReply(user.id, customer, text);
  if (reply) saveMessage(customer.id, { direction: 'out', source: reply.source, text: reply.text });
  return json({ reply });
});
