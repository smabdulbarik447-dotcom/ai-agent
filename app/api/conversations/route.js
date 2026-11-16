import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (req, _p, user) => {
  const q = `%${(req.nextUrl.searchParams.get('q') || '').toLowerCase()}%`;
  const attention = req.nextUrl.searchParams.get('attention') === '1' ? 1 : 0;
  return json(
    (await db
      .prepare(
        `SELECT c.*, (SELECT COALESCE(text, '📷 ছবি') FROM messages WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) AS last_text,
                (SELECT COUNT(*) FROM messages WHERE customer_id = c.id) AS message_count,
                (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count,
                (SELECT name FROM pages WHERE page_id = c.page_id) AS page_name
         FROM customers c WHERE c.user_id = ? AND c.is_test = 0
           AND (lower(IFNULL(c.name,'')) LIKE ? OR IFNULL(c.phone,'') LIKE ? OR c.psid LIKE ?)
           AND (? = 0 OR c.needs_human = 1)
         ORDER BY c.needs_human DESC, c.last_message_at DESC LIMIT 300`
      )
      .all(user.id, q, q, q, attention))
  );
});
