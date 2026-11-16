import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const POST = guard(async (req, { id }, user) => {
  const { paused } = await body(req);
  db.prepare('UPDATE customers SET bot_paused = ? WHERE id = ? AND user_id = ?').run(paused ? 1 : 0, id, user.id);
  return json({ ok: true });
});
