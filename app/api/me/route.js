import { db, getPlatform, getUserSettings } from '@/lib/db';
import { activeSubscription, aiUsage } from '@/lib/billing';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Who is logged in + what the sidebar needs (plan, badges)
export const GET = guard((_req, _p, user) => {
  const s = getUserSettings(user.id);
  const p = getPlatform();
  const one = (sql, ...a) => db.prepare(sql).get(...a).c;
  return json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    brand: { name: p.brand_name, tagline: p.brand_tagline },
    shop: { name: s.business_name, logo: s.logo_url || '/logo.svg' },
    subscription: activeSubscription(user.id),
    aiUsed: aiUsage(user.id),
    badges: {
      orders: one(`SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND status = 'new'`, user.id),
      unread: one('SELECT IFNULL(SUM(unread),0) AS c FROM customers WHERE user_id = ? AND is_test = 0', user.id),
      payments: user.role === 'admin' ? one(`SELECT COUNT(*) AS c FROM payments WHERE status = 'pending'`) : 0,
    },
  });
});
