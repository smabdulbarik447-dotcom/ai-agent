import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (req) => {
  const q = `%${(req.nextUrl.searchParams.get('q') || '').toLowerCase()}%`;
  const users = (await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.last_login_at,
         (SELECT value FROM user_settings WHERE user_id = u.id AND key = 'business_name') AS business_name,
         (SELECT COUNT(*) FROM pages WHERE user_id = u.id) AS pages,
         (SELECT COUNT(*) FROM products WHERE user_id = u.id) AS products,
         (SELECT IFNULL(SUM(ai_replies),0) FROM usage WHERE user_id = u.id AND month = strftime('%Y-%m','now')) AS ai_month,
         s.status AS sub_status, s.ends_at, s.plan_id, p.name AS plan_name
       FROM users u
       LEFT JOIN subscriptions s ON s.id = (
         SELECT id FROM subscriptions WHERE user_id = u.id AND status IN ('trial','active') AND ends_at > datetime('now')
         ORDER BY ends_at DESC LIMIT 1)
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE lower(u.email) LIKE ? OR lower(IFNULL(u.name,'')) LIKE ? OR IFNULL(u.phone,'') LIKE ?
       ORDER BY u.id DESC LIMIT 500`
    )
    .all(q, q, q));
  return json(users);
}, { admin: true });
