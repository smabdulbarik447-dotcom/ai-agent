import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (req) => {
  const st = req.nextUrl.searchParams.get('status') || '';
  return json(
    (await db
      .prepare(
        `SELECT pay.*, u.name AS user_name, u.email, u.phone AS user_phone, pl.name AS plan_name
         FROM payments pay JOIN users u ON u.id = pay.user_id JOIN plans pl ON pl.id = pay.plan_id
         WHERE (? = '' OR pay.status = ?) ORDER BY (pay.status = 'pending') DESC, pay.id DESC LIMIT 500`
      )
      .all(st, st))
  );
}, { admin: true });
