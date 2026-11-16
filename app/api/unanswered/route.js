import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Questions the AI couldn't answer, newest first, grouped so the same question shows once
export const GET = guard(async (_req, _p, user) => {
  const rows = await db
    .prepare(
      `SELECT u.*, c.name AS customer_name FROM unanswered u LEFT JOIN customers c ON c.id = u.customer_id
       WHERE u.user_id = ? AND u.status = 'open' ORDER BY u.id DESC LIMIT 200`
    )
    .all(user.id);
  const seen = new Map();
  for (const r of rows) {
    const key = r.question.trim().toLowerCase();
    if (seen.has(key)) seen.get(key).times++;
    else seen.set(key, { ...r, times: 1 });
  }
  return json([...seen.values()]);
});
