// Product photos uploaded from the dashboard. Vercel has no lasting disk, so the
// (already shrunk) photo is kept in the database and served from a public link
// `/i/<random id>` — Messenger, WhatsApp and the AI can all fetch it from there.
import crypto from 'node:crypto';
import { db, getPlatform } from './db.js';
import { publicUrl } from './api.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 2_000_000;
const OWN_RE = /\/i\/([a-f0-9]{24})(?:\.\w+)?$/;

/** A pasted/uploaded `data:image/...;base64,` → saved row → absolute public URL */
export async function storeImage(userId, dataUrl, req) {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl || '');
  if (!m || !TYPES[m[1].toLowerCase()]) throw new Error('শুধু JPG, PNG, WEBP বা GIF ছবি দেওয়া যাবে');
  const mime = m[1].toLowerCase();
  const data = m[2].replace(/\s+/g, '');
  if (Buffer.byteLength(data, 'base64') > MAX_BYTES) throw new Error('ছবিটা অনেক বড় (২ MB এর বেশি)');
  const id = crypto.randomBytes(12).toString('hex');
  await db.prepare('INSERT INTO images (id, user_id, mime, data) VALUES (?, ?, ?, ?)').run(id, userId, mime, data);
  const base = (await getPlatform()).public_url || publicUrl(req);
  return `${base}/i/${id}.${TYPES[mime]}`;
}

/** Product `image` field from the form: uploads become links, links pass through */
export async function resolveImage(userId, value, req) {
  if (typeof value !== 'string') return value;
  return value.startsWith('data:') ? storeImage(userId, value, req) : value.trim();
}

/** Remove an uploaded photo nobody uses any more (links to other sites are ignored) */
export async function dropImage(userId, url) {
  const id = OWN_RE.exec(url || '')?.[1];
  if (!id) return;
  const still = await db.prepare('SELECT 1 FROM products WHERE user_id = ? AND image LIKE ?').get(userId, `%/i/${id}%`);
  if (!still) await db.prepare('DELETE FROM images WHERE id = ? AND user_id = ?').run(id, userId);
}

export async function readImage(id) {
  return db.prepare('SELECT mime, data FROM images WHERE id = ?').get(id);
}
