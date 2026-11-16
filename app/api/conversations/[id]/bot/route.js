import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

// { paused } turns the bot on/off for this customer; { resolved: true } clears "needs attention"
export const POST = guard(async (req, { id }, user) => {
  const b = await body(req);
  if ('paused' in b) await db.prepare('UPDATE customers SET bot_paused = ? WHERE id = ? AND user_id = ?').run(b.paused ? 1 : 0, id, user.id);
  if (b.resolved) await db.prepare('UPDATE customers SET needs_human = 0, human_reason = NULL WHERE id = ? AND user_id = ?').run(id, user.id);
  return json({ ok: true });
});
