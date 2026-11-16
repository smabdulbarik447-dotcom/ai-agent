import * as cheerio from 'cheerio';
import { db, getUserSettings, upsertProduct, getJob, setJob } from './db.js';
import { activeSubscription, productRoom } from './billing.js';
import { createMessage, textOf } from './ai.js';
import { runLearning, learnStatus } from './learn.js';

const UA = 'Mozilla/5.0 (compatible; ShobPaaboBot/1.0; +product-sync)';

// Progress lives in the database so any server can show it
export const syncStatus = (userId) => getJob(userId, 'sync');

/** `st.progress = '...'` saves progress for the panel (at most every 2s); `st.deadline` is when to stop. */
function progressReporter(userId, budgetMs) {
  let last = 0;
  let text = '';
  return {
    userId,
    deadline: Date.now() + budgetMs,
    get progress() { return text; },
    set progress(t) {
      text = t;
      if (Date.now() - last < 2000) return;
      last = Date.now();
      setJob(userId, 'sync', { running: true, progress: t }).catch(() => {});
    },
  };
}

async function get(url, type = 'text') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : 'text/html,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return type === 'json' ? res.json() : res.text();
}

const stripHtml = (html) => (html ? cheerio.load(`<div>${html}</div>`)('div').text().replace(/\s+/g, ' ').trim() : '');
const num = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ---------- Shopify: /products.json ----------
async function tryShopify(origin, st) {
  const out = [];
  for (let page = 1; page <= 40; page++) {
    let data;
    try {
      data = await get(`${origin}/products.json?limit=250&page=${page}`, 'json');
    } catch {
      break;
    }
    if (!Array.isArray(data?.products) || !data.products.length) break;
    for (const p of data.products) {
      const v = p.variants?.[0] || {};
      const available = p.variants?.some((x) => x.available);
      const hasQty = p.variants?.some((x) => Number.isFinite(x.inventory_quantity));
      out.push({
        source_key: `shopify:${p.id}`,
        name: p.title,
        price: num(v.price),
        regular_price: num(v.compare_at_price),
        stock_status: available === undefined ? 'unknown' : available ? 'in_stock' : 'out_of_stock',
        stock_qty: hasQty ? p.variants.reduce((a, x) => a + (Number.isFinite(x.inventory_quantity) ? x.inventory_quantity : 0), 0) : null,
        sku: v.sku || null,
        category: p.product_type || null,
        description: stripHtml(p.body_html).slice(0, 2000),
        url: `${origin}/products/${p.handle}`,
        image: p.images?.[0]?.src || null,
        source: 'shopify',
      });
    }
    st.progress = `Shopify: ${out.length}টি প্রোডাক্ট পাওয়া গেছে`;
  }
  return out;
}

// ---------- WooCommerce: public Store API ----------
async function tryWoo(origin, st) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    let data;
    try {
      data = await get(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, 'json');
    } catch {
      break;
    }
    if (!Array.isArray(data) || !data.length) break;
    for (const p of data) {
      const minor = p.prices?.currency_minor_unit ?? 0;
      const conv = (x) => (x == null || x === '' ? null : Number(x) / 10 ** minor);
      out.push({
        source_key: `woo:${p.id}`,
        name: stripHtml(p.name),
        price: conv(p.prices?.price),
        regular_price: conv(p.prices?.regular_price),
        currency: p.prices?.currency_code || 'BDT',
        stock_status: p.is_in_stock === false ? 'out_of_stock' : p.is_in_stock ? 'in_stock' : 'unknown',
        stock_qty: Number.isFinite(p.low_stock_remaining) ? p.low_stock_remaining : null,
        sku: p.sku || null,
        category: p.categories?.map((c) => c.name).join(', ') || null,
        description: stripHtml(p.short_description || p.description).slice(0, 2000),
        url: p.permalink,
        image: p.images?.[0]?.src || null,
        source: 'woocommerce',
      });
    }
    st.progress = `WooCommerce: ${out.length}টি প্রোডাক্ট পাওয়া গেছে`;
  }
  return out;
}

// ---------- Generic: crawl pages and read schema.org / meta tags ----------
function availability(v) {
  const s = String(v || '').toLowerCase();
  if (/outofstock|soldout|discontinued/.test(s)) return 'out_of_stock';
  if (/instock|limitedavailability|preorder|onlineonly/.test(s)) return 'in_stock';
  return 'unknown';
}

function jsonLdProducts($) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if ([].concat(node['@type'] || []).includes('Product')) found.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).contents().text()));
    } catch {
      /* ignore broken JSON-LD */
    }
  });
  return found;
}

// ---------- Products embedded in page data ----------
// Many shop sites (Next.js, React landing pages) ship their product list as JSON inside the HTML,
// e.g. {"name":"...","price":899,"old_price":1499,"stock":1621,"image":"..."}. Find those objects.

/** Index of the brace that closes the object starting at `open` (strings respected), or -1 */
function closeBrace(t, open) {
  let depth = 0;
  for (let i = open; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      for (i++; i < t.length && t[i] !== '"'; i++) if (t[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

const pick = (o, keys) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '');

function embeddedProducts(html, url) {
  const t = html.replace(/\\"/g, '"'); // React/Next escape their JSON inside script strings
  const found = new Map();
  const PRICE = /"(price|sale_price|salePrice|offer_price|discount_price|regular_price|selling_price)"\s*:/g;
  let m;
  while ((m = PRICE.exec(t)) && found.size < 500) {
    // walk back to the "{" that opens the object holding this price
    let depth = 0;
    let open = -1;
    for (let i = m.index; i >= Math.max(0, m.index - 4000); i--) {
      if (t[i] === '}') depth++;
      else if (t[i] === '{') {
        if (depth === 0) { open = i; break; }
        depth--;
      }
    }
    if (open < 0) continue;
    const close = closeBrace(t, open);
    if (close < 0 || close - open > 6000) continue;
    let o;
    try {
      o = JSON.parse(t.slice(open, close + 1));
    } catch {
      continue;
    }
    const name = pick(o, ['name', 'title', 'product_name', 'productName']);
    const sale = num(pick(o, ['sale_price', 'salePrice', 'offer_price', 'discount_price', 'selling_price']));
    const price = sale ?? num(o.price);
    if (typeof name !== 'string' || name.length < 2 || price == null || price <= 0) continue;
    if (o.active === false || o.published === false) continue;
    const regular = num(pick(o, ['old_price', 'oldPrice', 'regular_price', 'regularPrice', 'compare_at_price', 'compareAtPrice', 'original_price', 'mrp'])) ?? (sale != null ? num(o.price) : null);
    const qty = typeof o.stock === 'number' ? o.stock : typeof o.quantity === 'number' ? o.quantity : null;
    const avail = pick(o, ['in_stock', 'inStock', 'available', 'is_available']);
    const img = pick(o, ['image', 'image_url', 'imageUrl', 'thumbnail', 'photo']) ?? (Array.isArray(o.images) ? o.images[0] : null);
    const key = `web:${new URL(url).origin}#${o.id ?? o.slug ?? name}`;
    found.set(key, {
      source_key: key,
      name: name.trim(),
      price,
      regular_price: regular && regular > price ? regular : null,
      stock_status: qty != null ? (qty > 0 ? 'in_stock' : 'out_of_stock') : avail == null ? 'unknown' : avail ? 'in_stock' : 'out_of_stock',
      stock_qty: qty,
      sku: o.sku ?? null,
      category: typeof o.category === 'string' ? o.category : o.category?.name ?? null,
      description: stripHtml(String(pick(o, ['description', 'short_description', 'details']) ?? '')).slice(0, 2000),
      url,
      image: typeof img === 'string' ? (img.startsWith('http') ? img : new URL(img, url).href) : img?.url || img?.src || null,
      source: 'website',
    });
  }
  return [...found.values()];
}

function extractFromPage(html, url) {
  const $ = cheerio.load(html);
  const products = jsonLdProducts($).map((p) => {
    const offer = [].concat(p.offers || [])[0] || {};
    const o = offer['@type'] === 'AggregateOffer' ? { ...offer, price: offer.lowPrice ?? offer.price } : offer;
    const img = [].concat(p.image || [])[0];
    return {
      source_key: `web:${p.url || url}${p.sku ? `#${p.sku}` : ''}`,
      name: p.name,
      price: num(o.price),
      currency: o.priceCurrency || 'BDT',
      stock_status: availability(o.availability),
      sku: p.sku || null,
      category: typeof p.category === 'string' ? p.category : null,
      description: stripHtml(p.description).slice(0, 2000),
      url: p.url || url,
      image: img?.url || (typeof img === 'string' ? img : null),
      source: 'website',
    };
  });
  if (products.length) return { products, $ };

  // Product lists inside the page's own data (Next.js / React landing pages)
  const embedded = embeddedProducts(html, url);
  if (embedded.length) return { products: embedded, $ };

  // OpenGraph / microdata fallback
  const meta = (n) => $(`meta[property="${n}"], meta[name="${n}"]`).attr('content');
  const price = meta('product:price:amount') || meta('og:price:amount') || $('[itemprop="price"]').attr('content');
  const title = meta('og:title') || $('h1').first().text();
  if (price && title) {
    return {
      products: [{
        source_key: `web:${url}`,
        name: title.trim(),
        price: num(price),
        currency: meta('product:price:currency') || 'BDT',
        stock_status: availability(meta('product:availability') || meta('og:availability') || $('[itemprop="availability"]').attr('href')),
        description: (meta('og:description') || '').slice(0, 2000),
        url,
        image: meta('og:image') || null,
        source: 'website',
      }],
      $,
    };
  }
  return { products: [], $ };
}

const nullable = (type) => ({ anyOf: [{ type }, { type: 'null' }] });
const PRODUCT_SCHEMA = {
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
        },
        required: ['name', 'price', 'regular_price', 'in_stock', 'category', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
};

/** Ask the AI to list the products on a page. Returns [] when there are none. */
async function aiExtract($, url, userId) {
  $('script, style, noscript, svg, header, footer, nav').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
  if (text.length < 80) return [];
  const response = await createMessage({
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PRODUCT_SCHEMA } },
    messages: [{
      role: 'user',
      content: `Below is the visible text of a page from an online shop (${url}). List every product that is offered for sale on it with its selling price (the offer price if there is one) and regular_price (the old / crossed-out price, or null). Prices are numbers in the page's currency (usually BDT/৳). Return an empty list if the page sells nothing.\n\n${text}`,
    }],
  }, { userId });
  if (response.stop_reason === 'refusal') return [];
  const data = JSON.parse(textOf(response) || '{"products":[]}');
  return (data.products || [])
    .filter((p) => p?.name)
    .map((p) => ({
      source_key: `web:${url}#${p.name}`,
      name: p.name,
      price: p.price,
      regular_price: p.regular_price,
      stock_status: p.in_stock == null ? 'unknown' : p.in_stock ? 'in_stock' : 'out_of_stock',
      category: p.category,
      description: p.description?.slice(0, 2000),
      url,
      source: 'website-ai',
    }));
}

async function sitemapUrls(origin) {
  const urls = new Set();
  const queue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/product-sitemap.xml`];
  const seen = new Set();
  while (queue.length && seen.size < 30) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      const $ = cheerio.load(await get(sm), { xmlMode: true });
      $('sitemap > loc').each((_, el) => queue.push($(el).text().trim()));
      $('url > loc').each((_, el) => urls.add($(el).text().trim()));
    } catch {
      /* sitemap missing */
    }
  }
  return [...urls];
}

async function crawlGeneric(origin, startUrl, maxPages, useAi, st) {
  const out = new Map();
  const fromSitemap = await sitemapUrls(origin);
  const isProductUrl = (u) => /product|item|shop|\/p\//i.test(u);
  const queue = [startUrl, ...fromSitemap.sort((a, b) => isProductUrl(b) - isProductUrl(a))];
  const visited = new Set();
  let startHtml = null;

  while (queue.length && visited.size < maxPages && Date.now() < st.deadline) {
    const url = queue.shift().split('#')[0];
    if (visited.has(url)) continue;
    visited.add(url);
    st.progress = `পেজ পড়া হচ্ছে ${visited.size}/${maxPages} — ${out.size}টি প্রোডাক্ট`;
    let html;
    try {
      html = await get(url);
    } catch {
      continue;
    }
    const { products, $ } = extractFromPage(html, url);
    for (const p of products) if (p.name) out.set(p.source_key, p);

    if (!startHtml) startHtml = html;
    if (!products.length && useAi && isProductUrl(url)) {
      try {
        for (const p of await aiExtract($, url, st.userId)) out.set(p.source_key, p);
      } catch (e) {
        console.error('[sync] AI extract failed', url, e.message);
      }
    }
    // Follow same-site links only when the sitemap didn't give us enough
    if (fromSitemap.length < 5) {
      $('a[href]').each((_, a) => {
        try {
          const u = new URL($(a).attr('href'), url);
          if (u.origin === origin && !/\.(jpg|jpeg|png|gif|webp|pdf|zip|css|js)$/i.test(u.pathname)) {
            const clean = u.origin + u.pathname + u.search;
            if (!visited.has(clean)) queue.push(clean);
          }
        } catch {
          /* bad href */
        }
      });
    }
  }
  // Nothing readable anywhere (e.g. a one-page landing site): let the AI read the first page
  if (!out.size && startHtml && !useAi) {
    st.progress = 'AI দিয়ে পেজ পড়া হচ্ছে...';
    try {
      for (const p of await aiExtract(cheerio.load(startHtml), startUrl, st.userId)) out.set(p.source_key, p);
    } catch (e) {
      console.error('[sync] AI fallback failed', startUrl, e.message);
    }
  }
  return [...out.values()];
}

/**
 * Read a shop's website into its products. Stops crawling after `budgetMs`
 * (serverless time limit); products found so far are still saved.
 */
export async function syncWebsite(userId, inputUrl, { budgetMs = 200_000 } = {}) {
  if ((await syncStatus(userId)).running) throw new Error('একটি সিঙ্ক ইতিমধ্যে চলছে');
  const sub = await activeSubscription(userId);
  if (!sub) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  if (!sub.website_sync) throw new Error(`${sub.plan_name} প্ল্যানে ওয়েবসাইট সিঙ্ক নেই। প্ল্যান আপগ্রেড করুন।`);
  const s = await getUserSettings(userId);
  const raw = (inputUrl || s.website_url || '').trim();
  if (!raw) throw new Error('ওয়েবসাইট URL দিন');
  const start = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  const origin = start.origin;

  const st = progressReporter(userId, budgetMs);
  await setJob(userId, 'sync', { running: true, progress: 'শুরু হচ্ছে...' });
  const logId = (await db.prepare("INSERT INTO sync_logs (user_id, url, status) VALUES (?, ?, 'running')").run(userId, start.href)).lastInsertRowid;

  let method = 'website';
  let final = '';
  try {
    // A mistyped or offline address should say so, not finish with "0 products"
    try {
      await get(start.href);
    } catch {
      throw new Error(`ওয়েবসাইট খোলা যাচ্ছে না (${start.host}) — লিংকের বানান ঠিক আছে কিনা দেখুন`);
    }
    let products = await tryShopify(origin, st);
    if (products.length) method = 'shopify';
    else {
      products = await tryWoo(origin, st);
      if (products.length) method = 'woocommerce';
      else products = await crawlGeneric(origin, start.href, Number(s.sync_max_pages) || 150, s.sync_ai_extract === '1', st);
    }
    // Existing products always update; new ones only while the plan has room
    let room = await productRoom(userId);
    let saved = 0;
    let skipped = 0;
    const known = new Set((await db.prepare('SELECT source_key FROM products WHERE user_id = ? AND source_key IS NOT NULL').all(userId)).map((r) => r.source_key));
    for (const p of products) {
      const isNew = !known.has(p.source_key);
      if (isNew && room <= 0) { skipped++; continue; }
      await upsertProduct(userId, p);
      saved++;
      if (isNew) room--;
    }
    const msg = !products.length
      ? 'কোনো প্রোডাক্ট পাওয়া যায়নি — Settings এ "AI দিয়ে পেজ পড়া" চালু করে দেখুন'
      : skipped
        ? `সফল — প্ল্যানের লিমিটের কারণে ${skipped}টি প্রোডাক্ট বাদ পড়েছে, আপগ্রেড করুন`
        : 'সফল';
    await db.prepare("UPDATE sync_logs SET status = 'done', method = ?, found = ?, message = ?, finished_at = datetime('now') WHERE id = ?")
      .run(method, saved, msg, logId);
    final = `সম্পন্ন: ${saved}টি প্রোডাক্ট (${method})${skipped ? ` — ${skipped}টি লিমিটের কারণে বাদ` : ''}`;
    return { method, found: saved, skipped };
  } catch (e) {
    await db.prepare("UPDATE sync_logs SET status = 'error', method = ?, message = ?, finished_at = datetime('now') WHERE id = ?")
      .run(method, e.message, logId);
    final = `ত্রুটি: ${e.message}`;
    throw e;
  } finally {
    await setJob(userId, 'sync', { running: false, progress: final, last: new Date().toISOString() });
  }
}

/**
 * One round of scheduled work for every shop: new Facebook posts and website re-sync when due.
 * Called by a timer on always-on servers and by Vercel Cron (`/api/cron`) on serverless.
 */
export async function scheduledTick({ budgetMs = 270_000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const users = await db.prepare("SELECT id FROM users WHERE status = 'active'").all();
  for (const { id } of users) {
    if (Date.now() > deadline) break;
    const s = await getUserSettings(id);
    const due = (Number(s.sync_interval_hours) || 6) * 3600_000;

    const ls = await learnStatus(id);
    const hasPages = await db.prepare('SELECT 1 FROM pages WHERE user_id = ? AND active = 1').get(id);
    if (hasPages && !ls.running && (!ls.last || Date.now() - Date.parse(ls.last) >= due)) {
      await runLearning(id, { budgetMs: Math.max(10_000, deadline - Date.now()) }).catch((e) => console.error(`[learn] user ${id}:`, e.message));
    }

    const hours = Number(s.sync_interval_hours);
    if (!s.website_url || !hours || (await syncStatus(id)).running) continue;
    if (!(await activeSubscription(id))?.website_sync) continue;
    const last = await db.prepare('SELECT started_at FROM sync_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(id);
    const lastMs = last ? Date.parse(last.started_at.replace(' ', 'T') + 'Z') : 0;
    if (Date.now() - lastMs < hours * 3600_000 || Date.now() > deadline - 30_000) continue;
    await syncWebsite(id, s.website_url, { budgetMs: Math.max(20_000, deadline - Date.now() - 20_000) })
      .then(() => runLearning(id, { pages: false, budgetMs: Math.max(10_000, deadline - Date.now()) }))
      .catch((e) => console.error(`[sync] user ${id} auto sync failed:`, e.message));
  }
}

// Always-on servers (Railway, your PC): run the scheduled work every 10 minutes
export function startAutoSync() {
  if (globalThis.__spAutoSync) return;
  globalThis.__spAutoSync = setInterval(() => {
    scheduledTick().catch((e) => console.error('[tick]', e.message));
  }, 10 * 60_000);
}
