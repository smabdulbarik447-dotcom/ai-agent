import { db } from './db.js';
import { checkLimit } from './billing.js';
import { subscribePage } from './facebook.js';

/** Connect (or refresh the token of) a Facebook page for a user. The caller starts learning afterwards. */
export async function connectPage(userId, { id, name, access_token }) {
  const existing = await db.prepare('SELECT * FROM pages WHERE page_id = ?').get(id);
  if (existing && existing.user_id !== userId) throw new Error(`"${name}" পেজটি অন্য একটি অ্যাকাউন্টে কানেক্ট করা আছে।`);
  if (!existing) await checkLimit(userId, 'pages');
  await subscribePage(id, access_token);
  if (existing) {
    await db.prepare('UPDATE pages SET name = ?, access_token = ?, active = 1 WHERE id = ?').run(name, access_token, existing.id);
  } else {
    await db.prepare('INSERT INTO pages (user_id, page_id, name, access_token) VALUES (?, ?, ?, ?)').run(userId, id, name, access_token);
  }
}
