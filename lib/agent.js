import { db, getUserSettings, searchProducts, relevantKnowledge, getCustomer, createCustomer, saveMessage } from './db.js';
import { createMessage, textOf, echoableContent } from './ai.js';
import { activeSubscription, canUseAi, countAiReply } from './billing.js';
import { getUserProfile, BOT_MARK } from './facebook.js';
import { sendTextTo, sendImageTo, actionTo, isWhatsApp } from './channel.js';
import { waMarkRead } from './whatsapp.js';
import { imageBlock } from './vision.js';
import { wordForms, setInterest, chatOrder, normPhone, orderAction, trackOrder, isBargain, deliveryFor, deliveryNote, orderButtons } from './sales.js';

const normalize = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[!?.,।;:"'()[\]{}…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function fillPlaceholders(text, customer, s) {
  return String(text)
    .replaceAll('{name}', customer?.name?.split(' ')[0] || '')
    .replaceAll('{business}', s.business_name || '')
    .replaceAll('{delivery_inside}', s.delivery_inside_dhaka || '')
    .replaceAll('{delivery_outside}', s.delivery_outside_dhaka || '')
    .replaceAll('{payment}', s.payment_methods || '')
    .replaceAll('{website}', s.website_url || '')
    .replace(/\s+!/g, '!');
}

export async function matchRule(userId, text) {
  const msg = normalize(text);
  if (!msg) return null;
  const rules = await db.prepare('SELECT * FROM rules WHERE user_id = ? AND active = 1 ORDER BY priority DESC, id ASC').all(userId);
  for (const rule of rules) {
    const keywords = rule.keywords.split(',').map(normalize).filter(Boolean);
    const hit = keywords.some((k) => {
      if (rule.match_type === 'exact') return msg === k;
      if (rule.match_type === 'starts') return msg.startsWith(k);
      return msg.includes(k);
    });
    if (hit) return rule;
  }
  return null;
}

const fmtProduct = (p) =>
  [
    `#${p.id} ${p.name}`,
    p.price != null
      ? `দাম: ৳${p.price}${p.regular_price && p.regular_price > p.price ? ` (আগের দাম ৳${p.regular_price})` : ''}`
      : 'দাম: জানা নেই',
    `স্টক: ${p.stock_status === 'in_stock' ? 'আছে' : p.stock_status === 'out_of_stock' ? 'নেই' : 'অজানা'}${p.stock_qty != null ? ` (${p.stock_qty}টি)` : ''}`,
    p.category ? `ক্যাটাগরি: ${p.category}` : '',
    p.url ? `লিংক: ${p.url}` : '',
    p.description ? `বিবরণ: ${p.description.slice(0, 400)}` : '',
    p.image_desc ? `ছবিতে দেখতে: ${p.image_desc.slice(0, 300)}` : '',
    p.image ? 'ছবি আছে' : '',
  ]
    .filter(Boolean)
    .join(' | ');

const SEARCH_TOOL = {
  name: 'search_products',
  description:
    'দোকানের প্রোডাক্ট ডাটাবেসে খোঁজে (নাম, ক্যাটাগরি, বিবরণ)। দাম, স্টক বা প্রোডাক্টের তথ্য বলার আগে অবশ্যই এটা ব্যবহার করো - কখনো দাম বা স্টক অনুমান করবে না। Search the shop catalog; query may be Bangla, English or Banglish.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Product name or keywords' } },
    required: ['query'],
    additionalProperties: false,
  },
  strict: true,
};

const IMAGE_TOOL = {
  name: 'send_product_image',
  description:
    'কাস্টমারকে একটি প্রোডাক্টের ছবি পাঠায় (যে প্রোডাক্টের "ছবি আছে")। কাস্টমার ছবি দেখতে চাইলে বা কোনো প্রোডাক্ট সাজেস্ট করলে ব্যবহার করো। একটি উত্তরে সর্বোচ্চ ৩টি ছবি। Sends the product photo to the customer after your text reply.',
  input_schema: {
    type: 'object',
    properties: { product_id: { type: 'integer' } },
    required: ['product_id'],
    additionalProperties: false,
  },
  strict: true,
};

const FLAG_TOOL = {
  name: 'flag_for_owner',
  description:
    'দোকানের মালিককে জানায় যে এই কথোপকথনে তার নজর দরকার। ব্যবহার করো যখন: (১) কাস্টমার যা জানতে চায় সেটা প্রোডাক্ট তালিকা বা শেখানো তথ্যে নেই, (২) কাস্টমার মানুষের সাথে কথা বলতে চায়, (৩) কাস্টমার অভিযোগ করছে বা রেগে আছে। এরপরও কাস্টমারকে ভদ্রভাবে উত্তর দেবে যে একজন প্রতিনিধি শীঘ্রই যোগাযোগ করবে। Tell the shop owner this chat needs them.',
  input_schema: {
    type: 'object',
    properties: {
      reason: { type: 'string', enum: ['unknown_answer', 'human_requested', 'complaint', 'other'] },
      question: { type: 'string', description: "The customer's question in their own words" },
    },
    required: ['reason', 'question'],
    additionalProperties: false,
  },
  strict: true,
};

const FLAG_REASON = {
  unknown_answer: 'AI উত্তর জানে না',
  human_requested: 'কাস্টমার মানুষের সাথে কথা বলতে চায়',
  complaint: 'অভিযোগ / অসন্তুষ্ট কাস্টমার',
  other: 'মালিকের নজর দরকার',
  no_ai_answer: 'AI উত্তর দিতে পারেনি',
};

/** Mark a chat for the owner and keep the question so they can teach the answer. */
export async function flagForOwner(userId, customer, reason, question) {
  if (customer?.id) {
    await db.prepare('UPDATE customers SET needs_human = 1, human_reason = ? WHERE id = ?').run(FLAG_REASON[reason] || FLAG_REASON.other, customer.id);
  }
  const q = String(question || '').trim();
  if (q && q !== '[ছবি]') {
    await db.prepare('INSERT INTO unanswered (user_id, customer_id, question, reason) VALUES (?, ?, ?, ?)')
      .run(userId, customer?.id ?? null, q.slice(0, 1000), FLAG_REASON[reason] || FLAG_REASON.other);
  }
}

const ORDER_TOOL = {
  name: 'create_order',
  description:
    'কাস্টমার স্পষ্টভাবে অর্ডার কনফার্ম করার পর এবং নাম, মোবাইল নম্বর ও পূর্ণ ঠিকানা পাওয়ার পরেই কেবল অর্ডার তৈরি করো। Only call after the customer explicitly confirms and has given name, phone and full address.',
  input_schema: {
    type: 'object',
    properties: {
      customer_name: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
      area: { type: 'string', enum: ['inside_dhaka', 'outside_dhaka'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { product_id: { type: 'integer' }, qty: { type: 'integer' } },
          required: ['product_id', 'qty'],
          additionalProperties: false,
        },
      },
      note: { type: 'string' },
    },
    required: ['customer_name', 'phone', 'address', 'area', 'items', 'note'],
    additionalProperties: false,
  },
  strict: true,
};

async function runTool(name, input, ctx) {
  const { userId, customer, s } = ctx;
  if (name === 'search_products') {
    const found = await searchProducts(userId, input.query, 8);
    if (found.length) await setInterest(customer, found[0].id).catch(() => {});
    return found.length ? found.map(fmtProduct).join('\n') : 'কোনো প্রোডাক্ট পাওয়া যায়নি।';
  }
  if (name === 'send_product_image') {
    const p = await db.prepare('SELECT name, image FROM products WHERE id = ? AND user_id = ?').get(input.product_id, userId);
    if (!p?.image) return 'এই প্রোডাক্টের ছবি নেই।';
    if (ctx.images.length >= 3) return 'এই উত্তরে আর ছবি পাঠানো যাবে না।';
    if (!ctx.images.includes(p.image)) ctx.images.push(p.image);
    return `"${p.name}" এর ছবি উত্তরের পরে পাঠানো হবে।`;
  }
  if (name === 'flag_for_owner') {
    await flagForOwner(userId, customer, input.reason, input.question);
    return 'মালিককে জানানো হয়েছে। কাস্টমারকে ভদ্রভাবে বলো যে একজন প্রতিনিধি শীঘ্রই যোগাযোগ করবে।';
  }
  if (name === 'create_order') {
    const items = [];
    for (const it of input.items || []) {
      const p = await db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(it.product_id, userId);
      if (!p) return `ভুল: product_id ${it.product_id} পাওয়া যায়নি। আগে search_products দিয়ে সঠিক id নাও।`;
      if (p.stock_status === 'out_of_stock') return `ভুল: "${p.name}" এখন স্টকে নেই।`;
      items.push({ product_id: p.id, name: p.name, qty: Math.max(1, it.qty || 1), price: p.price || 0 });
    }
    if (!items.length) return 'ভুল: কোনো আইটেম দেওয়া হয়নি।';
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    const delivery = deliveryFor(s, input.area === 'inside_dhaka', subtotal);
    const res = await db
      .prepare(
        `INSERT INTO orders (user_id, customer_id, customer_name, phone, address, items, subtotal, delivery, total, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, customer?.id ?? null, input.customer_name, normPhone(input.phone) || input.phone, input.address, JSON.stringify(items),
        subtotal, delivery, subtotal + delivery, input.note || '');
    if (customer?.id) {
      await db.prepare('UPDATE customers SET phone = ?, address = ?, name = COALESCE(name, ?), order_step = NULL WHERE id = ?')
        .run(input.phone, input.address, input.customer_name, customer.id);
    }
    ctx.quick = orderButtons(res.lastInsertRowid);
    return `অর্ডার তৈরি হয়েছে। অর্ডার নং #${res.lastInsertRowid}, সাবটোটাল ৳${subtotal}, ডেলিভারি ৳${delivery}, মোট ৳${subtotal + delivery}। উত্তরের নিচে কনফার্ম/বাতিল বাটন যাবে — কাস্টমারকে বলো সব ঠিক থাকলে "✅ কনফার্ম" চাপতে।`;
  }
  return `Unknown tool ${name}`;
}

async function systemPrompt({ userId, s, customer, canOrder }, relevant, knowledge) {
  const count = (await db.prepare('SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND active = 1').get(userId)).c;
  const cats = (await db
    .prepare("SELECT DISTINCT category FROM products WHERE user_id = ? AND active = 1 AND category IS NOT NULL AND category != '' LIMIT 30")
    .all(userId))
    .map((r) => r.category)
    .join(', ');
  const orderRule = canOrder
    ? '- কাস্টমার অর্ডার করতে চাইলে নাম, মোবাইল নম্বর, পূর্ণ ঠিকানা (ঢাকার ভিতরে না বাইরে) নিশ্চিত করবে, মোট দাম জানিয়ে কনফার্মেশন নেবে, তারপর create_order টুল কল করবে।'
    : '- কাস্টমার অর্ডার করতে চাইলে নাম, মোবাইল নম্বর ও পূর্ণ ঠিকানা নেবে এবং জানাবে যে একজন প্রতিনিধি কল করে অর্ডার কনফার্ম করবে।';
  return `তুমি "${s.business_name || 'আমাদের দোকান'}" এর Facebook পেজের সেলস এজেন্ট। Messenger এ কাস্টমারদের প্রশ্নের উত্তর দাও এবং অর্ডার নাও।

## দোকানের তথ্য
- ওয়েবসাইট: ${s.website_url || 'নেই'}
- ডেলিভারি: ${deliveryNote(s)}
- পেমেন্ট: ${s.payment_methods}
- মোট প্রোডাক্ট: ${count}টি${cats ? `; ক্যাটাগরি: ${cats}` : ''}
${s.business_info ? `- অতিরিক্ত তথ্য: ${s.business_info}` : ''}

## নিয়ম
- দাম, স্টক, প্রোডাক্টের তথ্য শুধু ডাটাবেস থেকে বলবে (নিচের তালিকা বা search_products টুল)। তালিকায় না থাকলে search_products দিয়ে খুঁজবে। কোথাও না পেলে বিনয়ের সাথে বলবে যে প্রোডাক্টটি এখন নেই - কখনো বানিয়ে বলবে না।
- স্টকে না থাকলে সেটা জানাবে এবং মিল আছে এমন অন্য প্রোডাক্ট সাজেস্ট করবে।
- কাস্টমার ছবি বা স্ক্রিনশট পাঠালে: ছবিতে কী প্রোডাক্ট আছে দেখো (ধরন, ব্র্যান্ড, লেখা, রং, প্যাকেট), সেই শব্দগুলো দিয়ে search_products চালাও, তারপর ফলাফলের "ছবিতে দেখতে" বর্ণনার সাথে মিলিয়ে সঠিক প্রোডাক্ট বের করো। মিললে নাম, দাম, অফার দাম (আগের দাম থাকলে), স্টক ও বিবরণ বলো। নিশ্চিত না হলে সবচেয়ে কাছের ২-৩টি অপশন দেখিয়ে জিজ্ঞেস করো কোনটা চান। একদম না মিললে বলো এটা এখন নেই এবং কাছাকাছি কিছু থাকলে সাজেস্ট করো।
- প্রোডাক্ট সাজেস্ট করলে বা কাস্টমার ছবি দেখতে চাইলে send_product_image দিয়ে ছবি পাঠাতে পারো।
- "মালিকের শেখানো তথ্য" অংশে যা আছে সেটা সবসময় মেনে চলবে — এটা দোকানের মালিক নিজে শিখিয়েছে।
${orderRule}
- কাস্টমার দামাদামি করলে (কম হবে? ডিসকাউন্ট? লাস্ট প্রাইস?) নিজে থেকে কখনো দাম কমাবে না।${s.bargain_reply ? ` এভাবে উত্তর দেবে: "${s.bargain_reply}"` : ''}
- উত্তর Messenger এর জন্য: ছোট, বন্ধুসুলভ, কোনো markdown (**, #) নয়। কাস্টমার যে ভাষায় লেখে (বাংলা/Banglish/English) সেই ভাষায় উত্তর দেবে।
- যেটা তুমি জানো না বা সমাধান করতে পারবে না (তথ্য নেই, রিটার্ন, অভিযোগ, মানুষের সাথে কথা বলতে চায়), সেখানে flag_for_owner টুল কল করবে এবং কাস্টমারকে বলবে একজন প্রতিনিধি শীঘ্রই যোগাযোগ করবে। কখনো তথ্য বানিয়ে বলবে না।
${s.ai_instructions ? `\n## মালিকের নির্দেশনা\n${s.ai_instructions}` : ''}
${knowledge.length ? `\n## মালিকের শেখানো তথ্য\n${knowledge.map((k) => `- ${k.title}: ${k.content}`).join('\n')}` : ''}

## কাস্টমার
নাম: ${customer?.name || 'অজানা'}${customer?.phone ? `, ফোন: ${customer.phone}` : ''}${customer?.address ? `, ঠিকানা: ${customer.address}` : ''}

## এই মেসেজের সাথে সম্ভাব্য প্রাসঙ্গিক প্রোডাক্ট
${relevant.length ? relevant.map(fmtProduct).join('\n') : '(কিছু পাওয়া যায়নি - দরকার হলে search_products ব্যবহার করো)'}`;
}

/**
 * Last 20 messages as Claude turns. Photos the customer sent in their latest turn are
 * attached as images (older photos stay as a text note to keep requests small).
 */
async function history(customerId) {
  const rows = (await db
    .prepare('SELECT direction, text, image_url FROM messages WHERE customer_id = ? AND (text IS NOT NULL OR image_url IS NOT NULL) ORDER BY id DESC LIMIT 20')
    .all(customerId))
    .reverse();
  let lastOut = -1;
  rows.forEach((r, i) => { if (r.direction === 'out') lastOut = i; });

  const msgs = [];
  for (const [i, r] of rows.entries()) {
    const role = r.direction === 'in' ? 'user' : 'assistant';
    if (!msgs.length && role === 'assistant') continue; // must start with user
    const blocks = [];
    if (r.image_url && role === 'user') {
      const img = i > lastOut ? await imageBlock(r.image_url) : null;
      blocks.push(img || { type: 'text', text: '[কাস্টমার একটি ছবি পাঠিয়েছিল]' });
    }
    if (r.image_url && role === 'assistant') blocks.push({ type: 'text', text: '[প্রোডাক্টের ছবি পাঠানো হয়েছে]' });
    if (r.text) blocks.push({ type: 'text', text: r.text });
    if (!blocks.length) continue;
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else msgs.push({ role, content: blocks });
  }
  while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop(); // latest turn = customer
  return msgs;
}

async function aiReply(ctx, latestText) {
  const messages = await history(ctx.customer.id);
  if (!messages.length) messages.push({ role: 'user', content: latestText });
  const system = await systemPrompt(ctx, await searchProducts(ctx.userId, latestText, 6), await relevantKnowledge(ctx.userId, latestText));
  const tools = [SEARCH_TOOL, IMAGE_TOOL, FLAG_TOOL, ...(ctx.canOrder ? [ORDER_TOOL] : [])];

  for (let i = 0; i < 6; i++) {
    const response = await createMessage({ max_tokens: 4000, system, tools, messages }, { userId: ctx.userId });
    if (response.stop_reason === 'refusal') return null;
    if (response.stop_reason !== 'tool_use') return textOf(response) || null;

    const content = echoableContent(response.content);
    messages.push({ role: 'assistant', content });
    const results = await Promise.all(
      content
        .filter((b) => b.type === 'tool_use')
        .map(async (b) => {
          try {
            return { type: 'tool_result', tool_use_id: b.id, content: await runTool(b.name, b.input, ctx) };
          } catch (e) {
            return { type: 'tool_result', tool_use_id: b.id, content: String(e.message), is_error: true };
          }
        })
    );
    messages.push({ role: 'user', content: results });
  }
  return null;
}

// Words that say "how much / do you have" rather than naming a product
const QUESTION_WORDS = new Set(['dam', 'daam', 'koto', 'price', 'prize', 'cost', 'ache', 'ase', 'ki', 'kemon', 'eta', 'ata', 'oita',
  'ta', 'er', 'ar', 'the', 'how', 'much', 'is', 'available', 'stock', 'vai', 'bhai', 'apu', 'please', 'plz', 'pls', 'ভাই', 'আপু',
  'দাম', 'কত', 'আছে', 'কি', 'কী', 'এটা', 'এর', 'টা', 'প্রাইস', 'স্টক']);

/**
 * Without the AI: if the message names a product, answer with its price/offer/stock from the database.
 * A product counts when at least half of the meaningful words in the message appear in its name.
 */
async function productAnswer(userId, text, s, customer) {
  const words = String(text || '')
    .toLowerCase()
    .split(/[\s,.?!।+\-/()]+/)
    .filter((w) => w.length >= 2 && !QUESTION_WORDS.has(w));
  if (!words.length) return null;
  // "combo" also finds "কম্বো", "6" also finds "৬"
  const forms = words.map(wordForms);
  const seen = new Map();
  for (const f of forms) for (const p of await searchProducts(userId, f.join(' '), 10)) seen.set(p.id, p);
  const need = Math.max(1, Math.ceil(words.length / 2));
  const found = [...seen.values()]
    .map((p) => ({ p, hits: forms.filter((f) => f.some((w) => p.name.toLowerCase().includes(w))).length }))
    .filter((x) => x.hits >= need)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((x) => x.p);
  if (!found.length) return null;
  await setInterest(customer, found[0].id).catch(() => {});
  const lines = found.map((p) => {
    const offer = p.regular_price && p.regular_price > p.price ? ` (আগের দাম ৳${p.regular_price})` : '';
    const stock = p.stock_status === 'out_of_stock' ? 'এখন স্টকে নেই' : p.stock_status === 'in_stock' ? 'স্টকে আছে ✅' : '';
    return `${p.name}\nদাম: ৳${p.price ?? '?'}${offer}${stock ? `\n${stock}` : ''}`;
  });
  return `${lines.join('\n\n')}\n\n${deliveryNote(s)}। অর্ডার করতে নাম, মোবাইল নম্বর ও ঠিকানা দিন 😊`;
}

/**
 * Decide the reply for an incoming customer message.
 * Order: owner-defined rules -> AI agent (if enabled and within plan quota) -> fallback text.
 * Shops without an active plan get no automatic replies.
 * Returns { text, source, images } — images are product photo URLs to send after the text.
 */
export async function decideReply(userId, customer, text, { hasImage = false, payload = null } = {}) {
  const sub = await activeSubscription(userId);
  if (!sub) return null;
  const s = await getUserSettings(userId);
  // "✅ কনফার্ম" / "❌ বাতিল" on a new order
  const action = hasImage ? null : await orderAction(userId, customer, text, payload).catch((e) => console.error('[order]', e.message));
  if (action) return { text: action, source: 'order', images: [] };
  // A photo needs the AI to look at it, so keyword rules only apply to plain text
  const rule = hasImage ? null : await matchRule(userId, text);
  if (rule) {
    await db.prepare('UPDATE rules SET hits = hits + 1 WHERE id = ?').run(rule.id);
    return { text: fillPlaceholders(rule.reply, customer, s), source: 'rule', images: [] };
  }
  // "amar order kothay?" -> status and tracking link straight from the order list
  const track = text && !hasImage ? await trackOrder(userId, customer, text).catch(() => null) : null;
  if (track) return { text: track, source: 'order', images: [] };
  if (s.ai_enabled === '1' && (await canUseAi(userId))) {
    const ctx = { userId, s, customer, canOrder: !!sub.ai_orders, images: [] };
    try {
      const reply = await aiReply(ctx, text);
      if (reply) {
        await countAiReply(userId);
        return { text: reply, source: 'ai', images: ctx.images, quick: ctx.quick };
      }
    } catch (e) {
      console.error(`[ai] user ${userId} reply failed:`, e.message);
    }
  }
  if (text && !hasImage) {
    // phone number / address typed in chat -> order for the product they asked about
    const ordered = await chatOrder(userId, customer, text, s, !!sub.ai_orders).catch((e) => console.error('[order]', e.message));
    if (ordered) return { text: ordered.text || ordered, source: 'order', images: [], quick: ordered.quick };
    if (isBargain(text) && s.bargain_reply) return { text: fillPlaceholders(s.bargain_reply, customer, s), source: 'rule', images: [] };
    const known = await productAnswer(userId, text, s, customer).catch(() => null);
    if (known) return { text: known, source: 'product', images: [] };
    await flagForOwner(userId, customer, 'no_ai_answer', text).catch(() => {});
  }
  if (s.fallback_reply) return { text: fillPlaceholders(s.fallback_reply, customer, s), source: 'fallback', images: [] };
  return null;
}

// ------------------------------------------------------------------
// Messenger event handling
// ------------------------------------------------------------------
async function getOrCreateCustomer(page, psid, hint = {}) {
  const c = await getCustomer(page.page_id, psid);
  if (c) return c;
  if (isWhatsApp(page)) {
    // the WhatsApp id is the customer's phone number
    const created = await createCustomer(page.user_id, page.page_id, psid, { name: hint.name || null });
    const phone = normPhone(psid);
    if (phone) await db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(phone, created.id);
    return getCustomer(page.page_id, psid);
  }
  const prof = await getUserProfile(page.access_token, psid);
  const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null;
  return createCustomer(page.user_id, page.page_id, psid, { name, pic: prof?.profile_pic || null });
}

export async function testCustomer(userId) {
  const pageId = `test-${userId}`;
  return (await getCustomer(pageId, 'panel')) || createCustomer(userId, pageId, 'panel', { name: 'টেস্ট কাস্টমার', isTest: 1 });
}

/** The connected page for a webhook entry, only if its owner may use the bot. */
export async function pageForWebhook(pageId) {
  return (
    (await db
      .prepare(
        `SELECT p.* FROM pages p JOIN users u ON u.id = p.user_id
         WHERE p.page_id = ? AND p.active = 1 AND u.status = 'active'`
      )
      .get(pageId)) || null
  );
}

// Process one customer at a time so replies stay in order
const queues = (globalThis.__spQueues ||= new Map());
export function enqueue(key, job) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(job).catch((e) => console.error('[webhook]', e.message));
  queues.set(key, next);
  next.finally(() => queues.get(key) === next && queues.delete(key));
  return next;
}

export async function handleCustomerMessage(page, psid, mid, text, imageUrl = null, payload = null, hint = {}) {
  const customer = await getOrCreateCustomer(page, psid, hint);
  if (!(await saveMessage(customer.id, { mid, direction: 'in', source: 'customer', text, image_url: imageUrl }))) return; // duplicate delivery
  if (customer.bot_paused) return;

  if (isWhatsApp(page)) waMarkRead(page, mid);
  actionTo(page, psid, 'mark_seen');
  actionTo(page, psid, 'typing_on');
  const reply = await decideReply(page.user_id, customer, text, { hasImage: !!imageUrl, payload });
  actionTo(page, psid, 'typing_off');
  if (!reply) return;
  const ids = await sendTextTo(page, psid, reply.text, { quick: reply.quick });
  await saveMessage(customer.id, { mid: ids[0], direction: 'out', source: reply.source, text: reply.text });
  for (const url of reply.images) {
    try {
      const r = await sendImageTo(page, psid, url);
      await saveMessage(customer.id, { mid: r.message_id, direction: 'out', source: reply.source, text: null, image_url: url });
    } catch (e) {
      console.error('[send] product image failed:', e.message);
    }
  }
}

export async function handlePageEcho(page, psid, message) {
  if (message.metadata === BOT_MARK) return; // our own bot reply
  const customer = await getOrCreateCustomer(page, psid);
  const saved = await saveMessage(customer.id, { mid: message.mid, direction: 'out', source: 'page', text: message.text || '[অ্যাটাচমেন্ট]' });
  // A human replied from the Page inbox - let them take over
  if (saved && (await getUserSettings(page.user_id)).pause_on_manual_reply === '1') {
    await db.prepare('UPDATE customers SET bot_paused = 1 WHERE id = ?').run(customer.id);
  }
}
