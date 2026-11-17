import { db, getPlatform } from './db.js';

const month = () => new Date().toISOString().slice(0, 7);

const PLAN_FIELDS = ['name', 'slug', 'price', 'period_days', 'max_pages', 'max_products', 'ai_replies', 'max_rules', 'website_sync', 'ai_orders', 'features', 'active', 'sort'];
const PLAN_NUMERIC = new Set(['price', 'period_days', 'max_pages', 'max_products', 'ai_replies', 'max_rules', 'sort']);
const PLAN_BOOL = new Set(['website_sync', 'ai_orders', 'active']);

/** Clean plan fields from an admin form */
export function planValues(b) {
  return Object.fromEntries(
    PLAN_FIELDS.filter((k) => k in b).map((k) => [
      k,
      PLAN_NUMERIC.has(k) ? Number(b[k]) || 0 : PLAN_BOOL.has(k) ? (b[k] ? 1 : 0) : String(b[k] ?? '').trim(),
    ])
  );
}

export function getPlans({ all = false } = {}) {
  return db.prepare(`SELECT * FROM plans ${all ? '' : 'WHERE active = 1'} ORDER BY sort, price`).all();
}

/** The subscription currently in force (trial or paid), joined with its plan. */
export async function activeSubscription(userId) {
  return (
    (await db
      .prepare(
        `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug, p.max_pages, p.max_products, p.ai_replies, p.max_rules,
                p.website_sync, p.ai_orders, p.price
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = ? AND s.status IN ('trial','active') AND s.ends_at > datetime('now')
         ORDER BY s.ends_at DESC LIMIT 1`
      )
      .get(userId)) || null
  );
}

export async function aiUsage(userId) {
  return (await db.prepare('SELECT ai_replies FROM usage WHERE user_id = ? AND month = ?').get(userId, month()))?.ai_replies || 0;
}

export async function countAiReply(userId) {
  await db.prepare(
    'INSERT INTO usage (user_id, month, ai_replies) VALUES (?, ?, 1) ON CONFLICT(user_id, month) DO UPDATE SET ai_replies = usage.ai_replies + 1'
  ).run(userId, month());
}

const unlimited = (n) => !n || n <= 0;
const count = async (sql, userId) => (await db.prepare(sql).get(userId)).c;

/** Throws a user-facing error if `what` would go over the plan's limit. */
export async function checkLimit(userId, what) {
  const sub = await activeSubscription(userId);
  if (!sub) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  const q = {
    pages: ['max_pages', 'SELECT COUNT(*) AS c FROM pages WHERE user_id = ?', 'Facebook পেজ / WhatsApp নম্বর'],
    products: ['max_products', 'SELECT COUNT(*) AS c FROM products WHERE user_id = ?', 'প্রোডাক্ট'],
    rules: ['max_rules', 'SELECT COUNT(*) AS c FROM rules WHERE user_id = ?', 'রুল'],
  }[what];
  const limit = sub[q[0]];
  if (unlimited(limit)) return sub;
  if ((await count(q[1], userId)) >= limit) {
    throw new Error(`আপনার ${sub.plan_name} প্ল্যানে সর্বোচ্চ ${limit}টি ${q[2]} রাখা যায়। আরও লাগলে প্ল্যান আপগ্রেড করুন।`);
  }
  return sub;
}

/** Remaining product slots (Infinity when unlimited). */
export async function productRoom(userId) {
  const sub = await activeSubscription(userId);
  if (!sub) return 0;
  if (unlimited(sub.max_products)) return Infinity;
  return Math.max(0, sub.max_products - (await count('SELECT COUNT(*) AS c FROM products WHERE user_id = ?', userId)));
}

export async function canUseAi(userId) {
  const sub = await activeSubscription(userId);
  if (!sub) return false;
  return unlimited(sub.ai_replies) || (await aiUsage(userId)) < sub.ai_replies;
}

/** Give a user `planId` for `days` days. Same plan still running -> extend it. */
export async function grantPlan(userId, planId, days, status = 'active') {
  const cur = await activeSubscription(userId);
  if (cur && cur.plan_id === planId && cur.status === status) {
    await db.prepare(`UPDATE subscriptions SET ends_at = datetime(ends_at, '+${Number(days)} days') WHERE id = ?`).run(cur.id);
    return;
  }
  if (cur) await db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?").run(cur.id);
  await db.prepare(`INSERT INTO subscriptions (user_id, plan_id, status, ends_at) VALUES (?, ?, ?, datetime('now', '+${Number(days)} days'))`)
    .run(userId, planId, status);
}

export async function startTrial(userId) {
  const p = await getPlatform();
  const days = Number(p.trial_days) || 0;
  if (days <= 0) return;
  const plan = (await db.prepare('SELECT id FROM plans WHERE slug = ?').get(p.trial_plan)) || (await getPlans())[0];
  if (plan) await grantPlan(userId, plan.id, days, 'trial');
}

export async function approvePayment(paymentId) {
  const pay = await db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!pay) throw new Error('পেমেন্ট পাওয়া যায়নি');
  if (pay.status !== 'pending') throw new Error('এই পেমেন্ট আগেই রিভিউ করা হয়েছে');
  const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(pay.plan_id);
  await grantPlan(pay.user_id, plan.id, plan.period_days || 30);
  await db.prepare("UPDATE payments SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?").run(paymentId);
}
