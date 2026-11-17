import { db } from '@/lib/db';
import { unsubscribePage } from '@/lib/facebook';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

// Turn the bot on/off for one page
export const PUT = guard(async (req, { id }, user) => {
  const { active } = await body(req);
  (await db.prepare('UPDATE pages SET active = ? WHERE id = ? AND user_id = ?').run(active ? 1 : 0, id, user.id));
  return json({ ok: true });
});

export const DELETE = guard(async (_req, { id }, user) => {
  const page = (await db.prepare('SELECT * FROM pages WHERE id = ? AND user_id = ?').get(id, user.id));
  if (!page) throw new Error('পেজ পাওয়া যায়নি');
  if (page.channel !== 'whatsapp') await unsubscribePage(page.page_id, page.access_token).catch(() => {});
  (await db.prepare('DELETE FROM pages WHERE id = ?').run(page.id));
  return json({ ok: true });
});
