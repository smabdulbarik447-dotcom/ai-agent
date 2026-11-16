import { cookies } from 'next/headers';
import { db, getPlatform, getUserSettings } from '@/lib/db';
import { activeSubscription, aiUsage } from '@/lib/billing';
import { guard, json, ADMIN_BACK_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Who is logged in + what the sidebar needs (plan, badges, admin notice)
export const GET = guard(async (_req, _p, user) => {
  const s = await getUserSettings(user.id);
  const p = await getPlatform();
  const one = async (sql, ...a) => (await db.prepare(sql).get(...a)).c;
  return json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    brand: { name: p.brand_name, tagline: p.brand_tagline },
    shop: { name: s.business_name, logo: s.logo_url || '/logo.svg' },
    subscription: await activeSubscription(user.id),
    aiUsed: await aiUsage(user.id),
    // the admin is looking at this account through "login as user"
    impersonating: !!(await cookies()).get(ADMIN_BACK_COOKIE)?.value,
    announcement: p.announcement_text ? { text: p.announcement_text, type: p.announcement_type || 'info' } : null,
    badges: {
      orders: await one(`SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND status = 'new'`, user.id),
      unread: await one('SELECT IFNULL(SUM(unread),0) AS c FROM customers WHERE user_id = ? AND is_test = 0', user.id),
      attention: await one('SELECT COUNT(*) AS c FROM customers WHERE user_id = ? AND is_test = 0 AND needs_human = 1', user.id),
      unanswered: await one("SELECT COUNT(DISTINCT lower(trim(question))) AS c FROM unanswered WHERE user_id = ? AND status = 'open'", user.id),
      payments: user.role === 'admin' ? await one(`SELECT COUNT(*) AS c FROM payments WHERE status = 'pending'`) : 0,
    },
  });
});
