import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard((req, _p, user) => {
  const st = req.nextUrl.searchParams.get('status') || '';
  return json(db.prepare(`SELECT * FROM orders WHERE user_id = ? AND (? = '' OR status = ?) ORDER BY id DESC LIMIT 500`).all(user.id, st, st));
});
