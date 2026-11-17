// Selling helpers that work without the AI: Banglish words, phone numbers,
// orders typed in chat, follow-ups for quiet customers, and fake-order risk.
import { db, getUserSettings, saveMessage } from './db.js';
import { activeSubscription } from './billing.js';
import { sendText } from './facebook.js';

// ------------------------------------------------------------------
// Banglish <-> Bangla words customers mix in their messages
// ------------------------------------------------------------------
const SYNONYMS = [
  ['কম্বো', 'combo', 'kombo', 'combu'],
  ['আতর', 'attar', 'ator', 'attor', 'atar', 'itor', 'itr', 'ittar'],
  ['পারফিউম', 'perfume', 'parfum', 'perfum', 'porfume', 'সুগন্ধি'],
  ['বডি স্প্রে', 'body spray', 'spray', 'স্প্রে'],
  ['তেল', 'oil', 'tel', 'অয়েল'],
  ['ক্রিম', 'cream', 'krim', 'crim'],
  ['সাবান', 'soap', 'saban', 'সোপ'],
  ['শ্যাম্পু', 'shampoo', 'sampoo', 'shampu'],
  ['ফেসওয়াশ', 'facewash', 'face wash', 'ফেস ওয়াশ'],
  ['লোশন', 'lotion', 'losion'],
  ['মিলি', 'ml', 'mili', 'মি.লি'],
  ['গ্রাম', 'gm', 'gram', 'g'],
  ['বক্স', 'box', 'boxes', 'baksho', 'বাক্স'],
  ['প্যাক', 'pack', 'packet', 'প্যাকেট'],
  ['প্রিমিয়াম', 'premium', 'primium'],
  ['অরিজিনাল', 'original', 'orginal', 'আসল'],
  ['শার্ট', 'shirt', 'sart'],
  ['টি-শার্ট', 'tshirt', 't-shirt', 'টিশার্ট'],
  ['প্যান্ট', 'pant', 'pants'],
  ['পাঞ্জাবি', 'panjabi', 'punjabi', 'panjabee'],
  ['শাড়ি', 'saree', 'sari', 'shari'],
  ['থ্রি পিস', 'three piece', '3 piece', 'থ্রিপিস', 'threepiece'],
  ['বোরকা', 'borka', 'burqa', 'borkha'],
  ['হিজাব', 'hijab', 'hijap'],
  ['জুতা', 'shoe', 'shoes', 'juta', 'sandal', 'স্যান্ডেল'],
  ['ব্যাগ', 'bag', 'beg'],
  ['ঘড়ি', 'watch', 'ghori', 'ghori'],
  ['চশমা', 'sunglass', 'glass', 'chosma'],
  ['মোবাইল', 'mobile', 'phone', 'ফোন'],
  ['চার্জার', 'charger', 'charjar'],
  ['হেডফোন', 'headphone', 'earphone', 'ইয়ারফোন', 'earbuds', 'এয়ারবাডস'],
  ['কাভার', 'cover', 'case', 'কেস'],
  ['বাচ্চা', 'baby', 'kids', 'kid', 'শিশু'],
  ['ছেলে', 'men', 'male', 'gents', 'জেন্টস'],
  ['মেয়ে', 'women', 'female', 'ladies', 'লেডিস'],
  ['মধু', 'honey', 'modhu'],
  ['ঘি', 'ghee', 'ghi'],
  ['চা', 'tea', 'cha'],
  ['খেজুর', 'dates', 'khejur'],
  ['প্যাড', 'pad', 'pads', 'স্যানিটারি'],
  ['ডায়াপার', 'diaper', 'dyper'],
];
const SYN_INDEX = new Map();
for (const group of SYNONYMS) for (const w of group) SYN_INDEX.set(w.toLowerCase(), group.map((x) => x.toLowerCase()));

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toEnDigits = (t) => String(t || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const toBnDigits = (t) => String(t).replace(/[0-9]/g, (d) => BN_DIGITS[d]);

/** Every way a word may be written in a product name: Bangla/English synonym and Bangla/English digits. */
export function wordForms(word) {
  const w = word.toLowerCase();
  const forms = new Set([w, ...(SYN_INDEX.get(w) || [])]);
  if (/[0-9০-৯]/.test(w)) {
    forms.add(toEnDigits(w));
    forms.add(toBnDigits(toEnDigits(w)));
  }
  return [...forms];
}

// ------------------------------------------------------------------
// Bangladeshi mobile numbers
// ------------------------------------------------------------------
const PHONE_RE = /(?:\+?\s*8\s*8[\s-]*)?0[\s-]*1[\s-]*[3-9](?:[\s-]*\d){8}/;

/** '+880 1712-345678' -> '01712345678' (or '' when it isn't a BD mobile number) */
export function normPhone(p) {
  const d = toEnDigits(p).replace(/\D/g, '').replace(/^88(?=01)/, '');
  return /^01[3-9]\d{8}$/.test(d) ? d : '';
}

export function findPhone(text) {
  const m = toEnDigits(text).match(PHONE_RE);
  return m ? { raw: m[0], phone: normPhone(m[0]) } : null;
}

// ------------------------------------------------------------------
// What the customer was looking at, for orders and follow-ups
// ------------------------------------------------------------------
export async function setInterest(customer, productId) {
  if (!customer?.id || !productId) return;
  if (customer.interest_product === productId) return;
  customer.interest_product = productId;
  await db.prepare("UPDATE customers SET interest_product = ?, interest_at = datetime('now'), followup_at = NULL WHERE id = ?")
    .run(productId, customer.id);
}

// "2ta", "২টা", "3 pcs" (\b doesn't work next to Bangla letters, so look ahead for a non-letter instead)
const QTY_RE = /(\d{1,2})\s*(?:ta|ti|টা|টি|pcs|pc|piece|pis|box|বক্স|pack|প্যাক|khana|খানা)(?![a-z])/i;
const LABEL_RE = /(?:^|\s)(?:name|nam|address|addres|thikana|mobile|number|phone|নাম|ঠিকানা|মোবাইল|নম্বর|নাম্বার)\s*[:：-]?/gi;
const INTENT_RE = /^(?:order|অর্ডার|nibo|nebo|nib|নিব|নিবো|নেব|নেবো|লাগবে|চাই|confirm|কনফার্ম|ok|okay|ঠিক আছে|done|plz|please)(?:\s|$)/i;

const NAME_RE = /^\s*(?:name|nam|নাম)\s*[:：-]\s*(.+)$/i;

/** The address part of a chat message: drops labels, "2ta nibo" and "order confirm" bits */
function addressFrom(text) {
  return String(text)
    .split(/[,\n]+/)
    .filter((p) => !NAME_RE.test(p))
    .map((p) => p.replace(LABEL_RE, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p && !(p.length < 25 && (QTY_RE.test(toEnDigits(p)) || INTENT_RE.test(p))))
    .join(', ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
    .trim();
}

/**
 * A customer typed their phone number (and usually their address) in chat while the AI is off or failed.
 * Turn it into an order for the product they last asked about. Returns the reply text, or null.
 */
export async function chatOrder(userId, customer, text, s, canOrder) {
  if (!customer?.id) return null;
  const clean = toEnDigits(text);
  const hit = findPhone(clean);
  const waitingAddress = customer.order_step === 'need_address' && !hit;
  if (!hit && !waitingAddress) return null;

  const product = customer.interest_product
    ? await db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ? AND active = 1').get(customer.interest_product, userId)
    : null;
  const phone = hit?.phone || customer.phone;
  // digits map one-to-one, so the number's position is the same in the original text (keeps Bangla digits)
  const at = hit ? clean.indexOf(hit.raw) : -1;
  let address = addressFrom(hit ? `${text.slice(0, at)}, ${text.slice(at + hit.raw.length)}` : text);
  if (address.length < 10) address = waitingAddress ? '' : customer.address || '';

  if (hit) await db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(phone, customer.id);

  if (!product) {
    if (!hit) return null;
    return 'ধন্যবাদ, আপনার নম্বর পেয়েছি ✅ কোন প্রোডাক্টটি নিতে চান সেটার নাম লিখুন বা ছবি দিন।';
  }
  if (product.stock_status === 'out_of_stock') {
    return `দুঃখিত, "${product.name}" এই মুহূর্তে স্টকে নেই 😔 অন্য কোনো প্রোডাক্ট দেখতে চাইলে নাম লিখুন।`;
  }
  if (!address) {
    await db.prepare("UPDATE customers SET order_step = 'need_address' WHERE id = ?").run(customer.id);
    return `নম্বর পেয়েছি ✅ এখন আপনার পূর্ণ ঠিকানা লিখুন (বাসা/রোড, এলাকা, থানা, জেলা) — তাহলেই "${product.name}" এর অর্ডার কনফার্ম হবে।`;
  }

  const qty = Math.min(10, Math.max(1, Number(clean.match(QTY_RE)?.[1]) || 1));
  const inside = /dhaka|ঢাকা/i.test(address);
  const delivery = Number(inside ? s.delivery_inside_dhaka : s.delivery_outside_dhaka) || 0;
  const subtotal = (product.price || 0) * qty;
  const typedName = String(text).split(/[,\n]+/).map((p) => p.match(NAME_RE)?.[1]?.trim()).find(Boolean);
  const name = typedName || customer.name || 'কাস্টমার';
  await db.prepare('UPDATE customers SET address = ?, order_step = NULL WHERE id = ?').run(address, customer.id);

  const summary = `প্রোডাক্ট: ${product.name} × ${qty}\nদাম: ৳${subtotal} + ডেলিভারি ৳${delivery} (${inside ? 'ঢাকার ভিতরে' : 'ঢাকার বাইরে'})\nমোট: ৳${subtotal + delivery}\nনাম: ${name}\nমোবাইল: ${phone}\nঠিকানা: ${address}`;
  if (!canOrder) {
    await db.prepare('UPDATE customers SET needs_human = 1, human_reason = ? WHERE id = ?').run('নতুন অর্ডারের অনুরোধ — কল করে কনফার্ম করুন', customer.id);
    return `ধন্যবাদ! আপনার অর্ডারের তথ্য পেয়েছি 😊\n\n${summary}\n\nআমাদের প্রতিনিধি কল করে অর্ডার কনফার্ম করবে।`;
  }
  const items = [{ product_id: product.id, name: product.name, qty, price: product.price || 0 }];
  const res = await db
    .prepare(
      `INSERT INTO orders (user_id, customer_id, customer_name, phone, address, items, subtotal, delivery, total, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, customer.id, name, phone, address, JSON.stringify(items), subtotal, delivery, subtotal + delivery, 'চ্যাট থেকে অটো অর্ডার');
  return `আপনার অর্ডার নেওয়া হয়েছে ✅ অর্ডার নং #${res.lastInsertRowid}\n\n${summary}\n\nকোনো তথ্য ভুল হলে এখানে লিখে জানান। ধন্যবাদ 😊`;
}

// ------------------------------------------------------------------
// Follow-up: the customer asked about a product, then went quiet without ordering
// ------------------------------------------------------------------
export function followupText(s, c) {
  return String(s.followup_text || '')
    .replaceAll('{name}', c.name?.split(' ')[0] || '')
    .replaceAll('{product}', c.pname || '')
    .replaceAll('{price}', c.pprice ?? '')
    .replace(/\s+([,!])/g, '$1');
}

export async function runFollowups(userId) {
  const s = await getUserSettings(userId);
  if (s.followup_enabled !== '1') return 0;
  if (!(await activeSubscription(userId))) return 0;
  const hours = Math.min(20, Math.max(1, Number(s.followup_hours) || 3));
  // Facebook only allows normal messages within 24 hours of the customer's last message
  const due = await db
    .prepare(
      `SELECT c.id, c.psid, c.name, p.name AS pname, p.price AS pprice, pg.access_token
       FROM customers c
       JOIN products p ON p.id = c.interest_product AND p.active = 1 AND p.stock_status != 'out_of_stock'
       JOIN pages pg ON pg.page_id = c.page_id AND pg.user_id = c.user_id AND pg.active = 1
       WHERE c.user_id = ? AND c.is_test = 0 AND c.bot_paused = 0 AND c.followup_at IS NULL
         AND c.last_message_at < datetime('now', ?)
         AND (SELECT MAX(m.created_at) FROM messages m WHERE m.customer_id = c.id AND m.direction = 'in') > datetime('now', '-23 hours')
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.created_at >= c.interest_at)
       LIMIT 20`
    )
    .all(userId, `-${hours} hours`);
  let sent = 0;
  for (const c of due) {
    // claim first so two servers never send it twice
    const claim = await db.prepare("UPDATE customers SET followup_at = datetime('now') WHERE id = ? AND followup_at IS NULL").run(c.id);
    if (!claim.changes) continue;
    const text = followupText(s, c);
    try {
      const ids = await sendText(c.access_token, c.psid, text);
      await saveMessage(c.id, { mid: ids[0], direction: 'out', source: 'followup', text });
      sent++;
    } catch (e) {
      console.error(`[followup] customer ${c.id}:`, e.message);
    }
  }
  return sent;
}

/** Follow up for every shop. Called by the cron/timer and (throttled) by webhook traffic. */
export async function followupTick({ budgetMs = 20_000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const users = await db.prepare("SELECT id FROM users WHERE status = 'active'").all();
  for (const { id } of users) {
    if (Date.now() > deadline) break;
    await runFollowups(id).catch((e) => console.error(`[followup] user ${id}:`, e.message));
  }
}

export function maybeFollowup() {
  const g = globalThis;
  if (Date.now() - (g.__spFollowupAt || 0) < 5 * 60_000) return Promise.resolve();
  g.__spFollowupAt = Date.now();
  return followupTick().catch((e) => console.error('[followup]', e.message));
}

/** How many follow-ups went out and how many turned into orders (last 30 days). */
export async function followupStats(userId) {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS sent,
         SUM(CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.created_at >= c.followup_at) THEN 1 ELSE 0 END) AS won
       FROM customers c WHERE c.user_id = ? AND c.followup_at > datetime('now', '-30 days')`
    )
    .get(userId);
  return { sent: Number(r?.sent || 0), won: Number(r?.won || 0) };
}

// ------------------------------------------------------------------
// Fake-order check: this phone's history across every shop on the platform (counts only)
// ------------------------------------------------------------------
const PHONE_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+88', ''), '+', '')";

export async function phoneRisk(phones) {
  const list = [...new Set(phones.map(normPhone).filter(Boolean))];
  const out = {};
  if (!list.length) return out;
  const variants = list.flatMap((p) => [p, '88' + p]);
  const rows = await db
    .prepare(`SELECT ${PHONE_SQL} AS p, status, COUNT(*) AS c FROM orders WHERE ${PHONE_SQL} IN (${variants.map(() => '?').join(',')}) GROUP BY 1, 2`)
    .all(...variants);
  for (const r of rows) {
    const p = normPhone(r.p);
    const x = (out[p] ||= { total: 0, delivered: 0, bad: 0 });
    const c = Number(r.c);
    x.total += c;
    if (r.status === 'delivered') x.delivered += c;
    if (r.status === 'cancelled' || r.status === 'returned') x.bad += c;
  }
  for (const x of Object.values(out)) {
    const done = x.delivered + x.bad;
    x.level = x.bad >= 2 && x.bad / Math.max(1, done) >= 0.4 ? 'high' : x.bad >= 1 ? 'medium' : x.delivered >= 1 ? 'good' : 'new';
  }
  return out;
}
