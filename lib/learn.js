import { db, upsertProduct, getJob, setJob } from './db.js';
import { createMessage, textOf } from './ai.js';
import { activeSubscription, productRoom } from './billing.js';
import { getPagePosts } from './facebook.js';
import { imageBlock, describeProductImage } from './vision.js';

// Background "learning": read Facebook page posts, then describe every product photo.
// Progress lives in the database so any server can show it.
export const learnStatus = (userId) => getJob(userId, 'learn');
const progress = (userId, text) => setJob(userId, 'learn', { running: true, progress: text });

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

async function readPost(post, userId) {
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
  }, { userId });
  if (response.stop_reason === 'refusal') return { products: [], info: '' };
  return JSON.parse(textOf(response) || '{"products":[],"info":""}');
}

async function importPage(userId, page, deadline) {
  const posts = await getPagePosts(page.page_id, page.access_token, 200);
  const seen = new Set((await db.prepare('SELECT post_id FROM fb_posts_seen WHERE user_id = ?').all(userId)).map((r) => r.post_id));
  const fresh = posts.filter((p) => (p.message || p.full_picture) && !seen.has(p.id));
  let added = 0;
  for (const [i, post] of fresh.entries()) {
    if (Date.now() > deadline) break; // the rest is picked up on the next run
    await progress(userId, `"${page.name}" পেজের পোস্ট পড়া হচ্ছে ${i + 1}/${fresh.length} — ${added}টি প্রোডাক্ট পাওয়া গেছে`);
    let r;
    try {
      r = await readPost(post, userId);
    } catch (e) {
      console.error(`[learn] post ${post.id}:`, e.message);
      continue; // try again next time
    }
    for (const [n, p] of (r.products || []).filter((x) => x?.name).entries()) {
      const key = `fb:${post.id}#${n}`;
      const isNew = !(await db.prepare('SELECT 1 FROM products WHERE user_id = ? AND source_key = ?').get(userId, key));
      if (isNew && (await productRoom(userId)) <= 0) continue;
      await upsertProduct(userId, {
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
    }
    if (r.info?.trim()) {
      await db.prepare(
        `INSERT INTO knowledge (user_id, title, content, source, source_key) VALUES (?, ?, ?, 'page_post', ?)
         ON CONFLICT(user_id, source_key) DO UPDATE SET content = excluded.content`
      ).run(userId, `Facebook পোস্ট (${(post.created_time || '').slice(0, 10)})`, r.info.trim(), `fb:${post.id}`);
    }
    await db.prepare('INSERT OR IGNORE INTO fb_posts_seen (user_id, post_id) VALUES (?, ?)').run(userId, post.id);
  }
  return added;
}

async function indexImages(userId, deadline, max = 300) {
  const todo = await db
    .prepare("SELECT id, name, image FROM products WHERE user_id = ? AND image IS NOT NULL AND image != '' AND image_desc IS NULL LIMIT ?")
    .all(userId, max);
  let done = 0;
  for (const [i, p] of todo.entries()) {
    if (Date.now() > deadline) break;
    await progress(userId, `প্রোডাক্টের ছবি দেখে শিখছে ${i + 1}/${todo.length}`);
    try {
      const desc = await describeProductImage(p.image, p.name, userId);
      // '' marks "tried, image unusable" so it isn't retried forever
      await db.prepare('UPDATE products SET image_desc = ? WHERE id = ?').run(desc || '', p.id);
      if (desc) done++;
    } catch (e) {
      console.error(`[learn] image ${p.id}:`, e.message);
    }
  }
  return done;
}

/**
 * Read connected pages + index product photos. Safe to call often; one run per user at a time.
 * Stops after `budgetMs` (serverless time limit) and continues where it left off next time.
 */
export async function runLearning(userId, { pages = true, budgetMs = 240_000 } = {}) {
  if ((await learnStatus(userId)).running) return;
  if (!(await activeSubscription(userId))) return;
  const deadline = Date.now() + budgetMs;
  await progress(userId, 'শুরু হচ্ছে...');
  const summary = { posts: 0, images: 0, errors: [] };
  let finalText = '';
  try {
    if (pages) {
      for (const page of await db.prepare("SELECT * FROM pages WHERE user_id = ? AND active = 1 AND COALESCE(channel, 'messenger') = 'messenger'").all(userId)) {
        try {
          summary.posts += await importPage(userId, page, deadline);
        } catch (e) {
          summary.errors.push(`${page.name}: ${e.message}`);
        }
      }
    }
    summary.images = await indexImages(userId, deadline);
    finalText = `সম্পন্ন — Facebook পোস্ট থেকে ${summary.posts}টি নতুন প্রোডাক্ট, ${summary.images}টি ছবি শেখা হয়েছে${summary.errors.length ? ` (সমস্যা: ${summary.errors.join('; ')})` : ''}`;
    if (Date.now() > deadline) finalText += ' — বাকিটা পরের বার শিখবে';
  } catch (e) {
    finalText = `ত্রুটি: ${e.message}`;
  } finally {
    await setJob(userId, 'learn', { running: false, progress: finalText, last: new Date().toISOString() });
  }
}
