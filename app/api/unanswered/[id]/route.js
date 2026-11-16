import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

// Mark a question taught (done) or not worth teaching (dismissed); same-text duplicates go with it
export const PUT = guard(async (req, { id }, user) => {
  const { status } = await body(req);
  if (!['done', 'dismissed'].includes(status)) throw new Error('ভুল স্ট্যাটাস');
  const row = await db.prepare('SELECT question FROM unanswered WHERE id = ? AND user_id = ?').get(id, user.id);
  if (!row) throw new Error('পাওয়া যায়নি');
  await db
    .prepare("UPDATE unanswered SET status = ? WHERE user_id = ? AND status = 'open' AND lower(trim(question)) = lower(trim(?))")
    .run(status, user.id, row.question);
  return json({ ok: true });
});
