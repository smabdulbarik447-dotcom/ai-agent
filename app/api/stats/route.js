import { db, getUserSettings } from '@/lib/db';
import { activeSubscription, aiUsage } from '@/lib/billing';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard((_req, _p, user) => {
  const uid = user.id;
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const s = getUserSettings(uid);
  // messages belong to customers; customers belong to the user
  const M = 'messages m JOIN customers c ON c.id = m.customer_id AND c.user_id = ? AND c.is_test = 0';
  const days = db
    .prepare(
      `WITH RECURSIVE d(day) AS (SELECT date('now','-13 days') UNION ALL SELECT date(day,'+1 day') FROM d WHERE day < date('now'))
       SELECT d.day,
         (SELECT COUNT(*) FROM ${M} WHERE date(m.created_at) = d.day AND m.direction = 'in') AS incoming,
         (SELECT COUNT(*) FROM ${M} WHERE date(m.created_at) = d.day AND m.direction = 'out' AND m.source IN ('rule','ai')) AS auto
       FROM d`
    )
    .all(uid, uid);
  const sources = db
    .prepare(`SELECT m.source, COUNT(*) AS c FROM ${M} WHERE m.direction = 'out' AND m.created_at >= datetime('now','-30 days') GROUP BY m.source ORDER BY c DESC`)
    .all(uid);
  const inCount = one(`SELECT COUNT(*) AS c FROM ${M} WHERE m.direction='in' AND m.created_at >= datetime('now','-30 days')`, uid).c;
  const autoCount = sources.filter((x) => x.source === 'rule' || x.source === 'ai').reduce((a, x) => a + x.c, 0);
  return json({
    business: { name: s.business_name, tagline: s.tagline, logo: s.logo_url || '/logo.svg' },
    totals: {
      conversations: one('SELECT COUNT(*) AS c FROM customers WHERE user_id = ? AND is_test = 0', uid).c,
      messagesToday: one(`SELECT COUNT(*) AS c FROM ${M} WHERE m.direction='in' AND date(m.created_at)=date('now')`, uid).c,
      products: one('SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND active = 1', uid).c,
      inStock: one(`SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND active = 1 AND stock_status = 'in_stock'`, uid).c,
      orders: one('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?', uid).c,
      newOrders: one(`SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND status = 'new'`, uid).c,
      sales: one(`SELECT IFNULL(SUM(total),0) AS c FROM orders WHERE user_id = ? AND status != 'cancelled'`, uid).c,
      autoRate: inCount ? Math.round((autoCount / inCount) * 100) : 0,
    },
    days,
    sources,
    recentOrders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 6').all(uid),
    recentConversations: db
      .prepare(
        `SELECT c.*, (SELECT COALESCE(text, '📷 ছবি') FROM messages WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) AS last_text
         FROM customers c WHERE c.user_id = ? AND c.is_test = 0 ORDER BY c.last_message_at DESC LIMIT 6`
      )
      .all(uid),
    attention: db
      .prepare(`SELECT id, name, price, stock_status, stock_qty FROM products WHERE user_id = ? AND active = 1 AND (stock_status = 'out_of_stock' OR (stock_qty IS NOT NULL AND stock_qty <= 5)) ORDER BY stock_qty ASC LIMIT 6`)
      .all(uid),
    setup: {
      plan: !!activeSubscription(uid),
      page: !!one('SELECT COUNT(*) AS c FROM pages WHERE user_id = ?', uid).c,
      products: !!one('SELECT COUNT(*) AS c FROM products WHERE user_id = ?', uid).c,
    },
    aiUsed: aiUsage(uid),
  });
});
