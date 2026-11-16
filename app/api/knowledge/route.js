import { db } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 1000;

export const GET = guard((_req, _p, user) =>
  json(db.prepare('SELECT * FROM knowledge WHERE user_id = ? ORDER BY id DESC').all(user.id))
);

// Teach the AI something: from the Training page (manual) or from an Inbox chat
export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  const title = String(b.title || '').trim();
  const content = String(b.content || '').trim();
  if (!title || !content) throw new Error('প্রশ্ন/বিষয় এবং উত্তর দুটোই লিখুন');
  if (db.prepare('SELECT COUNT(*) AS c FROM knowledge WHERE user_id = ?').get(user.id).c >= MAX_ENTRIES) {
    throw new Error(`সর্বোচ্চ ${MAX_ENTRIES}টি তথ্য রাখা যায় — পুরনো কিছু মুছে দিন`);
  }
  const r = db
    .prepare('INSERT INTO knowledge (user_id, title, content, source) VALUES (?, ?, ?, ?)')
    .run(user.id, title.slice(0, 300), content.slice(0, 4000), b.source === 'chat' ? 'chat' : 'manual');
  return json(db.prepare('SELECT * FROM knowledge WHERE id = ?').get(r.lastInsertRowid));
});
