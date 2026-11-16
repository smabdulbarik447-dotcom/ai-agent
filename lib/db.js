import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Platform-wide settings (super admin)
const PLATFORM_DEFAULTS = {
  brand_name: 'Shob Paabo AI',
  brand_tagline: 'যা চাই, সবই পাবো!',
  public_url: '',
  fb_app_id: '',
  fb_app_secret: '',
  fb_verify_token: 'shobpaabo-verify',
  anthropic_api_key: '',
  ai_model: 'claude-opus-5-5',
  ai_effort: 'low',
  trial_days: '3',
  trial_plan: 'starter',
  pay_bkash: '',
  pay_nagad: '',
  pay_rocket: '',
  pay_instructions: 'নিচের যেকোনো নম্বরে Send Money করে Transaction ID দিয়ে সাবমিট করুন। ১-২ ঘণ্টার মধ্যে আপনার প্ল্যান চালু হবে।',
};

// Per-user (shop) settings
const USER_DEFAULTS = {
  business_name: '',
  tagline: '',
  logo_url: '',
  website_url: '',
  ai_enabled: '1',
  ai_instructions:
    'সবসময় বাংলায়, ভদ্রভাবে ও ছোট করে উত্তর দিবে। কাস্টমারকে "আপু/ভাইয়া" বলে সম্বোধন করবে। অর্ডার নিতে নাম, মোবাইল নম্বর ও পূর্ণ ঠিকানা চাইবে।',
  delivery_inside_dhaka: '60',
  delivery_outside_dhaka: '120',
  payment_methods: 'ক্যাশ অন ডেলিভারি, বিকাশ, নগদ',
  business_info: '',
  fallback_reply: 'ধন্যবাদ! আমাদের একজন প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।',
  pause_on_manual_reply: '1',
  sync_interval_hours: '6',
  sync_max_pages: '150',
  sync_ai_extract: '0',
  fb_page_options: '[]', // pages returned by the last "Connect with Facebook", waiting for the user to pick
};

// 0 in a limit column means unlimited
const DEFAULT_PLANS = [
  { slug: 'starter', name: 'Starter', price: 499, period_days: 30, max_pages: 1, max_products: 100, ai_replies: 500, max_rules: 10, website_sync: 1, ai_orders: 0, sort: 1,
    features: 'ইনবক্স ও কাস্টমার লিস্ট' },
  { slug: 'business', name: 'Business', price: 1499, period_days: 30, max_pages: 3, max_products: 1000, ai_replies: 3000, max_rules: 50, website_sync: 1, ai_orders: 1, sort: 2,
    features: 'ইনবক্স ও কাস্টমার লিস্ট\nঅর্ডার ম্যানেজমেন্ট' },
  { slug: 'pro', name: 'Pro', price: 3999, period_days: 30, max_pages: 10, max_products: 0, ai_replies: 15000, max_rules: 0, website_sync: 1, ai_orders: 1, sort: 3,
    features: 'ইনবক্স ও কাস্টমার লিস্ট\nঅর্ডার ম্যানেজমেন্ট\nপ্রায়োরিটি সাপোর্ট' },
];

function open() {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'app.db');
  let db = new DatabaseSync(file);

  // A database from the single-shop version (no per-user columns) is kept as a backup
  const cols = db.prepare('PRAGMA table_info(products)').all();
  if (cols.length && !cols.some((c) => c.name === 'user_id')) {
    db.close();
    const backup = path.join(dataDir, `app-single-shop-backup-${Date.now()}.db`);
    for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(file + ext)) fs.renameSync(file + ext, backup + ext);
    console.log(`[db] old single-shop database moved to ${backup}`);
    db = new DatabaseSync(file);
  }

  db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT,
    phone         TEXT,
    role          TEXT DEFAULT 'user',     -- user | admin
    status        TEXT DEFAULT 'active',   -- active | suspended
    created_at    TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key     TEXT NOT NULL,
    value   TEXT,
    PRIMARY KEY (user_id, key)
  );

  CREATE TABLE IF NOT EXISTS plans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    price        REAL NOT NULL,
    period_days  INTEGER DEFAULT 30,
    max_pages    INTEGER DEFAULT 1,
    max_products INTEGER DEFAULT 100,
    ai_replies   INTEGER DEFAULT 500,      -- per month
    max_rules    INTEGER DEFAULT 10,
    website_sync INTEGER DEFAULT 1,
    ai_orders    INTEGER DEFAULT 0,
    features     TEXT,
    active       INTEGER DEFAULT 1,
    sort         INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    INTEGER NOT NULL REFERENCES plans(id),
    status     TEXT DEFAULT 'active',      -- trial | active | cancelled
    starts_at  TEXT DEFAULT (datetime('now')),
    ends_at    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id     INTEGER NOT NULL REFERENCES plans(id),
    amount      REAL,
    method      TEXT,                      -- bkash | nagad | rocket
    sender      TEXT,
    trx_id      TEXT,
    status      TEXT DEFAULT 'pending',    -- pending | approved | rejected
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS usage (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month      TEXT NOT NULL,              -- YYYY-MM
    ai_replies INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id      TEXT UNIQUE NOT NULL,     -- Facebook page id
    name         TEXT,
    access_token TEXT NOT NULL,
    active       INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_key    TEXT,
    name          TEXT NOT NULL,
    price         REAL,
    regular_price REAL,
    currency      TEXT DEFAULT 'BDT',
    stock_status  TEXT DEFAULT 'unknown',
    stock_qty     INTEGER,
    sku           TEXT,
    category      TEXT,
    description   TEXT,
    url           TEXT,
    image         TEXT,
    source        TEXT DEFAULT 'manual',
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now')),
    UNIQUE (user_id, source_key)
  );

  CREATE TABLE IF NOT EXISTS rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT,
    keywords   TEXT NOT NULL,
    match_type TEXT DEFAULT 'contains',
    reply      TEXT NOT NULL,
    priority   INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1,
    hits       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id     TEXT NOT NULL,
    psid        TEXT NOT NULL,
    name        TEXT,
    profile_pic TEXT,
    phone       TEXT,
    address     TEXT,
    bot_paused  INTEGER DEFAULT 0,
    unread      INTEGER DEFAULT 0,
    is_test     INTEGER DEFAULT 0,
    last_message_at TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE (page_id, psid)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    mid         TEXT UNIQUE,
    direction   TEXT NOT NULL,          -- in | out
    source      TEXT,                   -- customer | rule | ai | manual | fallback | page
    text        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id, id);

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    phone         TEXT,
    address       TEXT,
    items         TEXT,                 -- JSON [{product_id,name,qty,price}]
    subtotal      REAL,
    delivery      REAL,
    total         REAL,
    note          TEXT,
    status        TEXT DEFAULT 'new',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url         TEXT,
    method      TEXT,
    status      TEXT,
    found       INTEGER DEFAULT 0,
    message     TEXT,
    started_at  TEXT DEFAULT (datetime('now')),
    finished_at TEXT
  );
  `);

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(PLATFORM_DEFAULTS)) insertSetting.run(k, v);

  if (db.prepare('SELECT COUNT(*) AS c FROM plans').get().c === 0) {
    const cols = Object.keys(DEFAULT_PLANS[0]);
    const ins = db.prepare(`INSERT INTO plans (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    for (const p of DEFAULT_PLANS) ins.run(...cols.map((c) => p[c]));
  }
  return db;
}

// One connection per server process (Next.js may load this module more than once).
// Opened lazily on first use so `next build` workers never touch the file.
export const db = new Proxy({}, {
  get(_, key) {
    const conn = (globalThis.__spDb ||= open());
    const v = conn[key];
    return typeof v === 'function' ? v.bind(conn) : v;
  },
});

// ------------------------------------------------------------------
// Settings
// ------------------------------------------------------------------
export function getPlatform() {
  const s = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  s.anthropic_api_key ||= process.env.ANTHROPIC_API_KEY || '';
  s.fb_app_id ||= process.env.FB_APP_ID || '';
  s.fb_app_secret ||= process.env.FB_APP_SECRET || '';
  return s;
}

export function savePlatform(obj) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(obj)) if (k in PLATFORM_DEFAULTS) stmt.run(k, String(v ?? ''));
}

export function getUserSettings(userId) {
  const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId);
  return { ...USER_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

export function saveUserSettings(userId, obj) {
  const stmt = db.prepare(
    'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(obj)) if (k in USER_DEFAULTS) stmt.run(userId, k, String(v ?? ''));
}

// Example rules for a new account so the panel isn't empty
export function seedUser(userId) {
  const r = db.prepare('INSERT INTO rules (user_id, name, keywords, match_type, reply, priority) VALUES (?, ?, ?, ?, ?, ?)');
  r.run(userId, 'শুভেচ্ছা', 'hi, hello, হাই, হ্যালো, assalamu alaikum, আসসালামু আলাইকুম, salam, সালাম', 'exact',
    'ওয়ালাইকুম আসসালাম {name}! 😊 {business} এ আপনাকে স্বাগতম। কোন প্রোডাক্ট সম্পর্কে জানতে চান?', 10);
  r.run(userId, 'ডেলিভারি চার্জ', 'delivery charge, ডেলিভারি চার্জ, delivery koto, ডেলিভারি কত', 'contains',
    'ঢাকার ভিতরে ডেলিভারি চার্জ ৳{delivery_inside} এবং ঢাকার বাইরে ৳{delivery_outside}। ২-৩ দিনের মধ্যে ডেলিভারি দেওয়া হয়।', 5);
  r.run(userId, 'পেমেন্ট', 'payment, পেমেন্ট, bkash, বিকাশ, nagad, নগদ', 'contains', 'আমরা {payment} গ্রহণ করি। 🙏', 5);
}

// ------------------------------------------------------------------
// Products
// ------------------------------------------------------------------
const PRODUCT_FIELDS = ['name', 'price', 'regular_price', 'currency', 'stock_status', 'stock_qty', 'sku',
  'category', 'description', 'url', 'image', 'source'];

export function upsertProduct(userId, p) {
  const existing = p.source_key
    ? db.prepare('SELECT id FROM products WHERE user_id = ? AND source_key = ?').get(userId, p.source_key)
    : null;
  const vals = PRODUCT_FIELDS.map((f) => (p[f] === undefined || p[f] === '' ? null : p[f]));
  if (existing) {
    db.prepare(`UPDATE products SET ${PRODUCT_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...vals, existing.id);
    return existing.id;
  }
  const res = db
    .prepare(`INSERT INTO products (user_id, source_key, ${PRODUCT_FIELDS.join(', ')}) VALUES (?, ?, ${PRODUCT_FIELDS.map(() => '?').join(', ')})`)
    .run(userId, p.source_key ?? null, ...vals);
  return Number(res.lastInsertRowid);
}

export function searchProducts(userId, query, limit = 8) {
  const words = String(query || '')
    .toLowerCase()
    .split(/[\s,.?!।]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 8);
  if (!words.length) {
    return db.prepare('SELECT * FROM products WHERE user_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT ?').all(userId, limit);
  }
  const score = words
    .map(() => `(CASE WHEN lower(name) LIKE ? THEN 3 ELSE 0 END + CASE WHEN lower(IFNULL(category,'')) LIKE ? THEN 2 ELSE 0 END + CASE WHEN lower(IFNULL(description,'')) LIKE ? THEN 1 ELSE 0 END)`)
    .join(' + ');
  const params = words.flatMap((w) => [`%${w}%`, `%${w}%`, `%${w}%`]);
  return db
    .prepare(`SELECT *, (${score}) AS score FROM products WHERE user_id = ? AND active = 1 AND (${score}) > 0 ORDER BY score DESC LIMIT ?`)
    .all(...params, userId, ...params, limit);
}

// ------------------------------------------------------------------
// Customers & messages
// ------------------------------------------------------------------
export function getCustomer(pageId, psid) {
  return db.prepare('SELECT * FROM customers WHERE page_id = ? AND psid = ?').get(pageId, psid);
}

export function createCustomer(userId, pageId, psid, { name = null, pic = null, isTest = 0 } = {}) {
  db.prepare('INSERT OR IGNORE INTO customers (user_id, page_id, psid, name, profile_pic, is_test) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, pageId, psid, name, pic, isTest);
  return getCustomer(pageId, psid);
}

export function saveMessage(customerId, { mid = null, direction, source, text }) {
  const r = db
    .prepare('INSERT OR IGNORE INTO messages (customer_id, mid, direction, source, text) VALUES (?, ?, ?, ?, ?)')
    .run(customerId, mid, direction, source, text);
  db.prepare(`UPDATE customers SET last_message_at = datetime('now')${direction === 'in' ? ', unread = unread + 1' : ''} WHERE id = ?`)
    .run(customerId);
  return r.changes > 0;
}
