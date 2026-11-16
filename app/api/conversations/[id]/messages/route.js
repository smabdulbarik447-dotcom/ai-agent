import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard((_req, { id }, user) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!customer) throw new Error('কাস্টমার পাওয়া যায়নি');
  db.prepare('UPDATE customers SET unread = 0 WHERE id = ?').run(id);
  return json({
    customer,
    messages: db.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY id ASC LIMIT 500').all(id),
  });
});
