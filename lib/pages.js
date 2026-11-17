import { db } from './db.js';
import { checkLimit } from './billing.js';
import { subscribePage } from './facebook.js';
import { waPhoneInfo, waSubscribe } from './whatsapp.js';

/** Connect a WhatsApp Business number (Meta Cloud API) */
export async function connectWhatsApp(userId, { phone_id, waba_id, token, app_secret }) {
  phone_id = String(phone_id || '').trim();
  waba_id = String(waba_id || '').trim();
  token = String(token || '').trim();
  if (!/^\d{6,}$/.test(phone_id)) throw new Error('সঠিক Phone Number ID দিন (শুধু সংখ্যা)');
  if (!/^\d{6,}$/.test(waba_id)) throw new Error('সঠিক WhatsApp Business Account ID দিন (শুধু সংখ্যা)');
  if (!token) throw new Error('Access Token দিন');
  let info;
  try {
    info = await waPhoneInfo(phone_id, token);
  } catch (e) {
    throw new Error('নম্বর বা টোকেন কাজ করছে না: ' + e.message);
  }
  try {
    await waSubscribe(waba_id, token);
  } catch (e) {
    throw new Error('Webhook চালু করা যায়নি (WABA ID ঠিক আছে কিনা দেখুন): ' + e.message);
  }
  const name = `WhatsApp ${info.display_phone_number || phone_id}${info.verified_name ? ` (${info.verified_name})` : ''}`;
  const existing = await db.prepare('SELECT * FROM pages WHERE page_id = ?').get(phone_id);
  if (existing && existing.user_id !== userId) throw new Error('এই WhatsApp নম্বরটি অন্য একটি অ্যাকাউন্টে কানেক্ট করা আছে।');
  if (existing) {
    await db.prepare("UPDATE pages SET name = ?, access_token = ?, waba_id = ?, app_secret = ?, channel = 'whatsapp', active = 1 WHERE id = ?")
      .run(name, token, waba_id, app_secret || null, existing.id);
  } else {
    await checkLimit(userId, 'pages');
    await db.prepare("INSERT INTO pages (user_id, page_id, name, access_token, channel, waba_id, app_secret) VALUES (?, ?, ?, ?, 'whatsapp', ?, ?)")
      .run(userId, phone_id, name, token, waba_id, app_secret || null);
  }
  return { name };
}

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
