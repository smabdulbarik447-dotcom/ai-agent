import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = "status IN ('trial','active') AND ends_at > datetime('now')";

export const GET = guard(() => {
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;
  const days = db
    .prepare(
      `WITH RECURSIVE d(day) AS (SELECT date('now','-13 days') UNION ALL SELECT date(day,'+1 day') FROM d WHERE day < date('now'))
       SELECT d.day,
         (SELECT COUNT(*) FROM users u WHERE date(u.created_at) = d.day AND u.role = 'user') AS signups,
         (SELECT IFNULL(SUM(amount),0) FROM payments p WHERE date(p.reviewed_at) = d.day AND p.status = 'approved') AS revenue
       FROM d`
    )
    .all();
  return json({
    totals: {
      users: one("SELECT COUNT(*) AS c FROM users WHERE role = 'user'"),
      paying: one(`SELECT COUNT(DISTINCT user_id) AS c FROM subscriptions WHERE ${ACTIVE} AND status = 'active'`),
      trial: one(`SELECT COUNT(DISTINCT user_id) AS c FROM subscriptions WHERE ${ACTIVE} AND status = 'trial'`),
      pending: one("SELECT COUNT(*) AS c FROM payments WHERE status = 'pending'"),
      revenueMonth: one("SELECT IFNULL(SUM(amount),0) AS c FROM payments WHERE status = 'approved' AND strftime('%Y-%m', reviewed_at) = strftime('%Y-%m','now')"),
      revenueAll: one("SELECT IFNULL(SUM(amount),0) AS c FROM payments WHERE status = 'approved'"),
      aiMonth: one("SELECT IFNULL(SUM(ai_replies),0) AS c FROM usage WHERE month = strftime('%Y-%m','now')"),
      pages: one('SELECT COUNT(*) AS c FROM pages WHERE active = 1'),
    },
    days,
    plans: db
      .prepare(
        `SELECT p.name, (SELECT COUNT(DISTINCT s.user_id) FROM subscriptions s
                         WHERE s.plan_id = p.id AND s.status IN ('trial','active') AND s.ends_at > datetime('now')) AS c
         FROM plans p ORDER BY p.sort`
      )
      .all(),
    recentUsers: db.prepare("SELECT id, name, email, created_at FROM users WHERE role = 'user' ORDER BY id DESC LIMIT 6").all(),
    pendingPayments: db
      .prepare(
        `SELECT pay.*, u.name AS user_name, u.email, pl.name AS plan_name FROM payments pay
         JOIN users u ON u.id = pay.user_id JOIN plans pl ON pl.id = pay.plan_id
         WHERE pay.status = 'pending' ORDER BY pay.id LIMIT 6`
      )
      .all(),
  });
}, { admin: true });
