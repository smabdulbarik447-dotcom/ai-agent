import { db } from '@/lib/db';
import { grantPlan } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

// Suspend/activate an account, give it a plan for N days, or end its plan
export const PUT = guard(async (req, { id }, admin) => {
  const b = await body(req);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw new Error('ইউজার পাওয়া যায়নি');
  if (b.status) {
    if (user.id === admin.id) throw new Error('নিজের অ্যাকাউন্ট সাসপেন্ড করা যাবে না');
    if (!['active', 'suspended'].includes(b.status)) throw new Error('ভুল স্ট্যাটাস');
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(b.status, id);
    if (b.status === 'suspended') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (b.grant) {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(b.grant.plan_id);
    const days = Number(b.grant.days);
    if (!plan || !(days > 0)) throw new Error('প্ল্যান ও দিন সঠিকভাবে দিন');
    grantPlan(user.id, plan.id, days);
  }
  if (b.endPlan) {
    db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status IN ('trial','active')").run(id);
  }
  return json({ ok: true });
}, { admin: true });

export const DELETE = guard((_req, { id }, admin) => {
  if (Number(id) === admin.id) throw new Error('নিজের অ্যাকাউন্ট ডিলিট করা যাবে না');
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return json({ ok: true });
}, { admin: true });
