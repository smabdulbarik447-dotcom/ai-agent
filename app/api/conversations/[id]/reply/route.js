import { db, getUserSettings, saveMessage } from '@/lib/db';
import { sendText } from '@/lib/facebook';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const POST = guard(async (req, { id }, user) => {
  const c = (await db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(id, user.id));
  if (!c) throw new Error('কাস্টমার পাওয়া যায়নি');
  const page = (await db.prepare('SELECT * FROM pages WHERE page_id = ? AND user_id = ?').get(c.page_id, user.id));
  if (!page) throw new Error('এই কাস্টমারের Facebook পেজ আর কানেক্টেড নেই');
  const text = String((await body(req)).text || '').trim();
  if (!text) throw new Error('মেসেজ লিখুন');
  const ids = await sendText(page.access_token, c.psid, text);
  (await saveMessage(c.id, { mid: ids[0], direction: 'out', source: 'manual', text }));
  if ((await getUserSettings(user.id)).pause_on_manual_reply === '1') (await db.prepare('UPDATE customers SET bot_paused = 1 WHERE id = ?').run(c.id));
  return json({ ok: true });
});
