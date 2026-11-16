import { db, upsertProduct } from './db.js';
import { createMessage, textOf } from './ai.js';
import { activeSubscription, productRoom } from './billing.js';
import { getPagePosts } from './facebook.js';
import { imageBlock, describeProductImage } from './vision.js';

// Background "learning": read Facebook page posts, then describe every product photo
const states = (globalThis.__spLearn ||= new Map());
export function learnStatus(userId) {
  if (!states.has(userId)) states.set(userId, { running: false, progress: '', last: null });
  return states.get(userId);
}

const nullable = (type) => ({ anyOf: [{ type }, { type: 'null' }] });
const POST_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: nullable('number'),
          regular_price: nullable('number'),
          in_stock: nullable('boolean'),
          category: nullable('string'),
          description: { type: 'string' },
          image_description: { type: 'string' },
        },
        required: ['name', 'price', 'regular_price', 'in_stock', 'category', 'description', 'image_description'],
        additionalProperties: false,
      },
    },
    info: { type: 'string' },
  },
  required: ['products', 'info'],
  additionalProperties: false,
};

async function readPost(post) {
  const content = [];
  if (post.full_picture) {
    const img = await imageBlock(post.full_picture);
    if (img) content.push(img);
  }
  content.push({
    type: 'text',
    text: `This is a post from an online shop's Facebook page (Bangladesh). Caption:\n"""${post.message || '(no caption)'}"""

1. If the post sells or shows one or more products, list each one: name, selling price (offer price if there is one) as a number in BDT, regular_price (the old/crossed-out price, or null), in_stock (false if it says sold out/stock out, null if unknown), category, a short description in the caption's language, and image_description: what the product looks like in the photo (type, brand/text, colours, pattern, packaging) so it can be recognised from a customer screenshot.
2. info: any other useful shop information in the post (offers, discount codes, delivery rules, shop address, opening hours), or "" if none.
Return empty products if the post isn't about a product.`,
  });
  const response = await createMessage({
    max_tokens: 3000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: POST_SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return { products: [], info: '' };
  return JSON.parse(textOf(response) || '{"products":[],"info":""}');
}

async function importPage(userId, page, st) {
  const posts = await getPagePosts(page.page_id, page.access_token, 200);
  const seen = db.prepare('SELECT 1 FROM fb_posts_seen WHERE user_id = ? AND post_id = ?');
  const fresh = posts.filter((p) => (p.message || p.full_picture) && !seen.get(userId, p.id));
  let added = 0;
  for (const [i, post] of fresh.entries()) {
    st.progress = `"${page.name}" পেজের পোস্ট পড়া হচ্ছে ${i + 1}/${fresh.length} — ${added}টি প্রোডাক্ট পাওয়া গেছে`;
    let r;
    try {
      r = await readPost(post);
    } catch (e) {
      console.error(`[learn] post ${post.id}:`, e.message);
      continue; // try again next time
    }
    (r.products || []).filter((p) => p?.name).forEach((p, n) => {
      const key = `fb:${post.id}#${n}`;
      const isNew = !db.prepare('SELECT 1 FROM products WHERE user_id = ? AND source_key = ?').get(userId, key);
      if (isNew && productRoom(userId) <= 0) return;
      upsertProduct(userId, {
        source_key: key,
        name: p.name,
        price: p.price,
        regular_price: p.regular_price,
        stock_status: p.in_stock == null ? 'unknown' : p.in_stock ? 'in_stock' : 'out_of_stock',
        category: p.category,
        description: p.description,
        image: post.full_picture || null,
        image_desc: p.image_description,
        url: post.permalink_url,
        source: 'facebook',
      });
      if (isNew) added++;
    });
    if (r.info?.trim()) {
      db.prepare(
        `INSERT INTO knowledge (user_id, title, content, source, source_key) VALUES (?, ?, ?, 'page_post', ?)
         ON CONFLICT(user_id, source_key) DO UPDATE SET content = excluded.content`
      ).run(userId, `Facebook পোস্ট (${(post.created_time || '').slice(0, 10)})`, r.info.trim(), `fb:${post.id}`);
    }
    db.prepare('INSERT OR IGNORE INTO fb_posts_seen (user_id, post_id) VALUES (?, ?)').run(userId, post.id);
  }
  return added;
}

async function indexImages(userId, st, max = 300) {
  const todo = db
    .prepare("SELECT id, name, image FROM products WHERE user_id = ? AND image IS NOT NULL AND image != '' AND image_desc IS NULL LIMIT ?")
    .all(userId, max);
  let done = 0;
  for (const [i, p] of todo.entries()) {
    st.progress = `প্রোডাক্টের ছবি দেখে শিখছে ${i + 1}/${todo.length}`;
    try {
      const desc = await describeProductImage(p.image, p.name);
      // '' marks "tried, image unusable" so it isn't retried forever
      db.prepare('UPDATE products SET image_desc = ? WHERE id = ?').run(desc || '', p.id);
      if (desc) done++;
    } catch (e) {
      console.error(`[learn] image ${p.id}:`, e.message);
    }
  }
  return done;
}

/** Read connected pages + index product photos. Safe to call often; one run per user at a time. */
export async function runLearning(userId, { pages = true } = {}) {
  const st = learnStatus(userId);
  if (st.running) return;
  if (!activeSubscription(userId)) return;
  st.running = true;
  st.progress = 'শুরু হচ্ছে...';
  const summary = { posts: 0, images: 0, errors: [] };
  try {
    if (pages) {
      for (const page of db.prepare('SELECT * FROM pages WHERE user_id = ? AND active = 1').all(userId)) {
        try {
          summary.posts += await importPage(userId, page, st);
        } catch (e) {
          summary.errors.push(`${page.name}: ${e.message}`);
        }
      }
    }
    summary.images = await indexImages(userId, st);
    st.progress = `সম্পন্ন — Facebook পোস্ট থেকে ${summary.posts}টি নতুন প্রোডাক্ট, ${summary.images}টি ছবি শেখা হয়েছে${summary.errors.length ? ` (সমস্যা: ${summary.errors.join('; ')})` : ''}`;
  } catch (e) {
    st.progress = `ত্রুটি: ${e.message}`;
  } finally {
    st.running = false;
    st.last = new Date().toISOString();
  }
}
