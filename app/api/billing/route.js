import { db, getPlatform } from '@/lib/db';
import { activeSubscription, aiUsage, getPlans } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METHODS = ['bkash', 'nagad', 'rocket'];

export const GET = guard((_req, _p, user) => {
  const p = getPlatform();
  const count = (sql) => db.prepare(sql).get(user.id).c;
  return json({
    plans: getPlans(),
    subscription: activeSubscription(user.id),
    usage: {
      ai: aiUsage(user.id),
      pages: count('SELECT COUNT(*) AS c FROM pages WHERE user_id = ?'),
      products: count('SELECT COUNT(*) AS c FROM products WHERE user_id = ?'),
      rules: count('SELECT COUNT(*) AS c FROM rules WHERE user_id = ?'),
    },
    payments: db
      .prepare('SELECT pay.*, pl.name AS plan_name FROM payments pay JOIN plans pl ON pl.id = pay.plan_id WHERE pay.user_id = ? ORDER BY pay.id DESC LIMIT 20')
      .all(user.id),
    accounts: Object.fromEntries(METHODS.map((m) => [m, p[`pay_${m}`]]).filter(([, v]) => v)),
    instructions: p.pay_instructions,
  });
});

// Submit a manual (Send Money) payment for the admin to verify
export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND active = 1').get(b.plan_id);
  if (!plan) throw new Error('প্ল্যান সিলেক্ট করুন');
  if (!METHODS.includes(b.method)) throw new Error('পেমেন্ট মেথড সিলেক্ট করুন');
  const trx = String(b.trx_id || '').trim().toUpperCase();
  const sender = String(b.sender || '').trim();
  if (trx.length < 6) throw new Error('সঠিক Transaction ID দিন');
  if (!/^01\d{9}$/.test(sender.replace(/\D/g, '').slice(-11))) throw new Error('যে নম্বর থেকে টাকা পাঠিয়েছেন সেটা দিন (01XXXXXXXXX)');
  if (db.prepare("SELECT 1 FROM payments WHERE trx_id = ? AND status != 'rejected'").get(trx)) throw new Error('এই Transaction ID আগেই জমা দেওয়া হয়েছে');
  if (db.prepare("SELECT 1 FROM payments WHERE user_id = ? AND status = 'pending'").get(user.id)) {
    throw new Error('আপনার একটি পেমেন্ট এখনো যাচাইয়ের অপেক্ষায় আছে');
  }
  db.prepare('INSERT INTO payments (user_id, plan_id, amount, method, sender, trx_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, plan.id, plan.price, b.method, sender, trx);
  return json({ ok: true });
});
