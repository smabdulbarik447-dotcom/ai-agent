import { createClient } from '@libsql/client';
import { toPg, schemaToPg, PG_FUNCTIONS, createPool } from './pg.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Platform-wide settings (super admin)
const PLATFORM_DEFAULTS = {
  brand_name: 'Shob Paabo AI',
  brand_tagline: 'যা চাই, সবই পাবো!',
  support_email: '',
  support_phone: '',
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
  announcement_text: '', // shown at the top of every user's dashboard
  announcement_type: 'info', // info | warn
  usd_to_bdt: '122', // for showing Claude API cost in Taka
  // Extra Facebook permissions — turn on only after adding them to the Meta app, or Facebook rejects the login
  fb_scope_posts: '0', // pages_read_engagement: read the page's posts to learn products
  fb_scope_comments: '0', // pages_read_user_content + pages_manage_engagement: reply to post comments
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
  comment_reply_enabled: '1', // answer Facebook post comments
  comment_public_reply: 'ধন্যবাদ {name}! 😊 বিস্তারিত আপনার ইনবক্সে পাঠানো হয়েছে, চেক করুন 📩',
  comment_dm_enabled: '1', // also send the details privately in Messenger
  notify_order_status: '1', // message the customer when an order's status changes
  steadfast_api_key: '',
  steadfast_secret_key: '',
  free_delivery_min: '0', // orders at or above this subtotal ship free (0 = off)
  bargain_reply: 'আমাদের দাম একদম ফিক্সড {name} 😊 কোয়ালিটিতে কোনো কম্প্রোমাইজ নেই, আর প্রোডাক্ট হাতে পেয়ে দেখে টাকা দেওয়ার সুবিধা আছে।',
  followup_enabled: '1', // remind customers who asked a price but didn't order
  followup_hours: '3',
  followup_text: '{name}, আপনি "{product}" সম্পর্কে জানতে চেয়েছিলেন 😊 এটা এখনো স্টকে আছে, দাম মাত্র ৳{price}। অর্ডার করতে শুধু আপনার মোবাইল নম্বর আর ঠিকানা লিখে পাঠান — আমরা পৌঁছে দেব 🚚',
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

// Columns added after the first release: [table, column, type]
const ADDED_COLUMNS = [
  ['products', 'image_desc', 'TEXT'], // what the product photo shows, written by the AI
  ['messages', 'image_url', 'TEXT'], // photo a customer sent (or a test-chat upload)
  ['customers', 'needs_human', 'INTEGER DEFAULT 0'], // AI asked the owner to step in
  ['customers', 'human_reason', 'TEXT'],
  ['orders', 'tracking_code', 'TEXT'], // courier tracking
  ['orders', 'consignment_id', 'TEXT'],
  ['usage', 'input_tokens', 'INTEGER DEFAULT 0'], // Claude API usage, for the admin's cost view
  ['usage', 'output_tokens', 'INTEGER DEFAULT 0'],
  ['usage', 'cost_usd', 'REAL DEFAULT 0'],
  ['customers', 'interest_product', 'INTEGER'], // product the customer last asked about
  ['customers', 'interest_at', 'TEXT'],
  ['customers', 'followup_at', 'TEXT'], // when the "still interested?" message went out
  ['customers', 'order_step', 'TEXT'],
  ['orders', 'customer_confirmed', 'INTEGER DEFAULT 0'],
  ['pages', 'channel', "TEXT DEFAULT 'messenger'"], // messenger | whatsapp
  ['pages', 'waba_id', 'TEXT'], // WhatsApp Business Account ID
  ['pages', 'app_secret', 'TEXT'], // the shop's own Meta app secret (WhatsApp webhooks signed by it) // 1 = customer tapped confirm, -1 = cancelled // need_address: gave a phone number, address still missing
];

// ------------------------------------------------------------------
// Connection, in order of preference:
//   1. PostgreSQL (Neon on Vercel) when DATABASE_URL / POSTGRES_URL is a postgres:// address
//   2. Turso / libSQL online database
//   3. a local SQLite file (your PC, Railway volume)
// Every helper is async because online databases are reached over the network.
// ------------------------------------------------------------------
const pgUrl = () =>
  [process.env.DATABASE_URL, process.env.POSTGRES_URL].find((u) => /^postgres(ql)?:\/\//.test(u || '')) || '';
export const isPostgres = () => !!pgUrl();
const remoteUrl = () =>
  process.env.TURSO_DATABASE_URL ||
  process.env.LIBSQL_URL ||
  (/^libsql:/.test(process.env.DATABASE_URL || '') ? process.env.DATABASE_URL : '');
export const isRemoteDb = () => isPostgres() || !!remoteUrl();
const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');

function connect() {
  if (isRemoteDb()) {
    return createClient({ url: remoteUrl(), authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN });
  }
  fs.mkdirSync(dataDir(), { recursive: true });
  return createClient({ url: `file:${path.join(dataDir(), 'app.db')}` });
}

const SCHEMA = `

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

  -- What the shop owner taught the AI (or what it learned from Page posts)
  CREATE TABLE IF NOT EXISTS knowledge (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,           -- question or topic
    content    TEXT NOT NULL,           -- answer / information
    source     TEXT DEFAULT 'manual',   -- manual | chat | page_post
    source_key TEXT,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (user_id, source_key)
  );

  -- Facebook posts already read, so they're never sent to the AI twice
  CREATE TABLE IF NOT EXISTS fb_posts_seen (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  -- Progress of background jobs (website sync, learning)
  CREATE TABLE IF NOT EXISTS jobs (
    user_id    INTEGER NOT NULL,
    kind       TEXT NOT NULL,           -- sync | learn
    running    INTEGER DEFAULT 0,
    progress   TEXT,
    last       TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, kind)
  );

  -- Questions the AI couldn't answer, for the owner to teach
  CREATE TABLE IF NOT EXISTS unanswered (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id INTEGER,
    question    TEXT NOT NULL,
    reason      TEXT,
    status      TEXT DEFAULT 'open',      -- open | done | dismissed
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Facebook post comments the bot answered (also stops double replies)
  CREATE TABLE IF NOT EXISTS comment_replies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id      TEXT,
    comment_id   TEXT UNIQUE NOT NULL,
    post_id      TEXT,
    from_name    TEXT,
    message      TEXT,
    public_reply TEXT,
    dm_text      TEXT,
    error        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- Product photos uploaded from the dashboard (served at /i/<id>)
  CREATE TABLE IF NOT EXISTS images (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
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
  `;

async function init(client) {
  const q = async (sql, args = []) => (await client.execute({ sql, args })).rows;

  if (!isRemoteDb()) {
    // A local database from the single-shop version (no per-user columns) is kept as a backup
    const cols = await q('PRAGMA table_info(products)');
    if (cols.length && !cols.some((c) => c.name === 'user_id')) {
      client.close();
      const file = path.join(dataDir(), 'app.db');
      const backup = path.join(dataDir(), `app-single-shop-backup-${Date.now()}.db`);
      for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(file + ext)) fs.renameSync(file + ext, backup + ext);
      console.log(`[db] old single-shop database moved to ${backup}`);
      client = connect();
    }
    await client.executeMultiple('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }

  await client.executeMultiple(SCHEMA);

  for (const [table, col, type] of ADDED_COLUMNS) {
    if (!(await q(`PRAGMA table_info(${table})`)).some((c) => c.name === col)) await q(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }

  await client.batch(
    Object.entries(PLATFORM_DEFAULTS).map(([k, v]) => ({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [k, v] })),
    'write'
  );
  if ((await q('SELECT COUNT(*) AS c FROM plans'))[0].c === 0) {
    const cols = Object.keys(DEFAULT_PLANS[0]);
    await client.batch(
      DEFAULT_PLANS.map((p) => ({ sql: `INSERT INTO plans (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, args: cols.map((c) => p[c]) })),
      'write'
    );
  }
  return client;
}

// PostgreSQL: create the helper functions + tables once.
// Neon's pooled URL (PgBouncer, transaction mode) can run each statement on a different
// server connection, so a session lock (pg_advisory_lock) could be taken on one and the
// unlock sent to another — leaving it held forever and hanging every new server. The lock
// is therefore transaction-scoped (released by COMMIT/ROLLBACK on the same connection),
// and the whole setup is skipped when the schema hasn't changed since the last run.
const SCHEMA_HASH = crypto.createHash('sha1').update(JSON.stringify([SCHEMA, ADDED_COLUMNS, PG_FUNCTIONS, PLATFORM_DEFAULTS])).digest('hex');

async function initPg(pool) {
  const c = await pool.connect();
  try {
    const current = await c.query("SELECT value FROM settings WHERE key = 'schema_hash'").then((r) => r.rows[0]?.value, () => null);
    if (current === SCHEMA_HASH) return { pg: pool };
    await c.query('BEGIN');
    try {
      await c.query("SET LOCAL lock_timeout = '20s'");
      await c.query('SELECT pg_advisory_xact_lock(727272)');
      const again = await c.query("SELECT to_regclass('settings') AS t").then((r) => r.rows[0].t
        ? c.query("SELECT value FROM settings WHERE key = 'schema_hash'").then((x) => x.rows[0]?.value)
        : null);
      if (again !== SCHEMA_HASH) {
        await c.query(PG_FUNCTIONS);
        await c.query(schemaToPg(SCHEMA));
        for (const [table, col, type] of ADDED_COLUMNS) {
          await c.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${schemaToPg(type)}`);
        }
        for (const [k, v] of Object.entries(PLATFORM_DEFAULTS)) {
          await c.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING', [k, v]);
        }
        if ((await c.query('SELECT COUNT(*) AS c FROM plans')).rows[0].c === 0) {
          const cols = Object.keys(DEFAULT_PLANS[0]);
          const marks = cols.map((_, i) => '$' + (i + 1)).join(', ');
          for (const p of DEFAULT_PLANS) {
            await c.query(`INSERT INTO plans (${cols.join(', ')}) VALUES (${marks})`, cols.map((k) => p[k]));
          }
        }
        await c.query("INSERT INTO settings (key, value) VALUES ('schema_hash', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [SCHEMA_HASH]);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    }
  } finally {
    c.release();
  }
  return { pg: pool };
}

// One connection (pool) per server process, opened on first use (never during `next build`)
function ready() {
  return (globalThis.__spDbReady ||= (isPostgres() ? initPg(createPool(pgUrl())) : init(connect())).catch((e) => {
    globalThis.__spDbReady = null; // let the next request retry
    throw e;
  }));
}

const clean = (args) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a));
const plain = (row) => (row ? { ...row } : undefined);

// Every backend answers with { rows, changes, lastInsertRowid }
async function execute(sql, args) {
  const client = await ready();
  if (client.pg) {
    const r = await client.pg.query(toPg(sql), clean(args));
    return { rows: r.rows, changes: r.rowCount ?? 0, lastInsertRowid: r.rows[0]?.id ?? 0 };
  }
  const rs = await client.execute({ sql, args: clean(args) });
  return { rows: rs.rows, changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid ?? 0 };
}

/** Same shape as before (`db.prepare(sql).get/all/run(...args)`), but every call returns a Promise. */
export const db = {
  prepare(sql) {
    return {
      get: async (...args) => plain((await execute(sql, args)).rows[0]),
      all: async (...args) => (await execute(sql, args)).rows.map(plain),
      run: async (...args) => {
        const rs = await execute(sql, args);
        return { changes: rs.changes, lastInsertRowid: Number(rs.lastInsertRowid) };
      },
    };
  },
  /** Several writes in one round trip: [[sql, ...args], ...] */
  async batch(statements) {
    const client = await ready();
    if (client.pg) {
      const c = await client.pg.connect();
      try {
        await c.query('BEGIN');
        for (const [sql, ...args] of statements) await c.query(toPg(sql), clean(args));
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        c.release();
      }
      return;
    }
    return client.batch(statements.map(([sql, ...args]) => ({ sql, args: clean(args) })), 'write');
  },
  /** Names of all app tables (for backups) */
  async tables() {
    const client = await ready();
    const sql = client.pg
      ? "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
      : "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    return (await execute(sql, [])).rows.map((r) => r.name);
  },
};

// ------------------------------------------------------------------
// Settings
// ------------------------------------------------------------------
export async function getPlatform() {
  const s = Object.fromEntries((await db.prepare('SELECT key, value FROM settings').all()).map((r) => [r.key, r.value]));
  s.anthropic_api_key ||= process.env.ANTHROPIC_API_KEY || '';
  s.fb_app_id ||= process.env.FB_APP_ID || '';
  s.fb_app_secret ||= process.env.FB_APP_SECRET || '';
  return s;
}

export async function savePlatform(obj) {
  const rows = Object.entries(obj).filter(([k]) => k in PLATFORM_DEFAULTS);
  if (!rows.length) return;
  await db.batch(rows.map(([k, v]) => ['INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v ?? '')]));
}

export async function getUserSettings(userId) {
  const rows = await db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId);
  return { ...USER_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

export async function saveUserSettings(userId, obj) {
  const rows = Object.entries(obj).filter(([k]) => k in USER_DEFAULTS);
  if (!rows.length) return;
  await db.batch(rows.map(([k, v]) => [
    'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
    userId, k, String(v ?? ''),
  ]));
}

// Example rules for a new account so the panel isn't empty
export async function seedUser(userId) {
  const sql = 'INSERT INTO rules (user_id, name, keywords, match_type, reply, priority) VALUES (?, ?, ?, ?, ?, ?)';
  await db.batch([
    [sql, userId, 'শুভেচ্ছা', 'hi, hello, হাই, হ্যালো, assalamu alaikum, আসসালামু আলাইকুম, salam, সালাম', 'exact',
      'ওয়ালাইকুম আসসালাম {name}! 😊 {business} এ আপনাকে স্বাগতম। কোন প্রোডাক্ট সম্পর্কে জানতে চান?', 10],
    [sql, userId, 'ডেলিভারি চার্জ', 'delivery charge, ডেলিভারি চার্জ, delivery koto, ডেলিভারি কত', 'contains',
      'ঢাকার ভিতরে ডেলিভারি চার্জ ৳{delivery_inside} এবং ঢাকার বাইরে ৳{delivery_outside}। ২-৩ দিনের মধ্যে ডেলিভারি দেওয়া হয়।', 5],
    [sql, userId, 'পেমেন্ট', 'payment, পেমেন্ট, bkash, বিকাশ, nagad, নগদ', 'contains', 'আমরা {payment} গ্রহণ করি। 🙏', 5],
  ]);
}

// Everything a user owns. Deleted explicitly because the online database doesn't enforce ON DELETE CASCADE.
export async function deleteUserData(userId) {
  const own = ['sessions', 'user_settings', 'subscriptions', 'payments', 'usage', 'pages', 'products', 'rules', 'orders',
    'knowledge', 'fb_posts_seen', 'sync_logs', 'images', 'jobs', 'unanswered', 'comment_replies'];
  await db.batch([
    ['DELETE FROM messages WHERE customer_id IN (SELECT id FROM customers WHERE user_id = ?)', userId],
    ['DELETE FROM customers WHERE user_id = ?', userId],
    ...own.map((t) => [`DELETE FROM ${t} WHERE user_id = ?`, userId]),
    ['DELETE FROM users WHERE id = ?', userId],
  ]);
}

// ------------------------------------------------------------------
// Background job state, shared by every server so progress shows wherever the page loads
// ------------------------------------------------------------------
const STALE_MIN = 10; // a job that stopped reporting is treated as finished

export async function getJob(userId, kind) {
  const j = await db
    .prepare(`SELECT *, (updated_at < datetime('now', '-${STALE_MIN} minutes')) AS stale FROM jobs WHERE user_id = ? AND kind = ?`)
    .get(userId, kind);
  return { running: !!(j?.running && !j.stale), progress: j?.progress || '', last: j?.last || null };
}

export async function setJob(userId, kind, patch) {
  const next = { ...(await getJob(userId, kind)), ...patch };
  await db
    .prepare(
      `INSERT INTO jobs (user_id, kind, running, progress, last, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, kind) DO UPDATE SET running = excluded.running, progress = excluded.progress, last = excluded.last, updated_at = excluded.updated_at`
    )
    .run(userId, kind, next.running ? 1 : 0, next.progress, next.last);
}

// ------------------------------------------------------------------
// Products
// ------------------------------------------------------------------
const PRODUCT_FIELDS = ['name', 'price', 'regular_price', 'currency', 'stock_status', 'stock_qty', 'sku',
  'category', 'description', 'url', 'image', 'source'];

export async function upsertProduct(userId, p) {
  const existing = p.source_key
    ? await db.prepare('SELECT id, image FROM products WHERE user_id = ? AND source_key = ?').get(userId, p.source_key)
    : null;
  const vals = PRODUCT_FIELDS.map((f) => (p[f] === undefined || p[f] === '' ? null : p[f]));
  let id;
  if (existing) {
    await db.prepare(`UPDATE products SET ${PRODUCT_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...vals, existing.id);
    id = existing.id;
    // A new photo needs a new description; an unchanged one keeps it
    if (!p.image_desc && (p.image || null) !== existing.image) await db.prepare('UPDATE products SET image_desc = NULL WHERE id = ?').run(id);
  } else {
    id = (
      await db.prepare(`INSERT INTO products (user_id, source_key, ${PRODUCT_FIELDS.join(', ')}) VALUES (?, ?, ${PRODUCT_FIELDS.map(() => '?').join(', ')})`)
        .run(userId, p.source_key ?? null, ...vals)
    ).lastInsertRowid;
  }
  if (p.image_desc) await db.prepare('UPDATE products SET image_desc = ? WHERE id = ?').run(p.image_desc, id);
  return id;
}

const searchWords = (query) =>
  String(query || '')
    .toLowerCase()
    .split(/[\s,.?!।]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 12);

export async function searchProducts(userId, query, limit = 8) {
  const words = searchWords(query);
  if (!words.length) {
    return db.prepare('SELECT * FROM products WHERE user_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT ?').all(userId, limit);
  }
  // name > photo description / category > description
  const score = words
    .map(() => `(CASE WHEN lower(name) LIKE ? THEN 3 ELSE 0 END + CASE WHEN lower(IFNULL(category,'')) LIKE ? THEN 2 ELSE 0 END
      + CASE WHEN lower(IFNULL(image_desc,'')) LIKE ? THEN 2 ELSE 0 END + CASE WHEN lower(IFNULL(description,'')) LIKE ? THEN 1 ELSE 0 END)`)
    .join(' + ');
  const params = words.flatMap((w) => [`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`]);
  return db
    .prepare(`SELECT *, (${score}) AS score FROM products WHERE user_id = ? AND active = 1 AND (${score}) > 0 ORDER BY score DESC LIMIT ?`)
    .all(...params, userId, ...params, limit);
}

/** Knowledge the AI should use: everything when it's small, otherwise the best matches. */
export async function relevantKnowledge(userId, query, limit = 6) {
  const all = await db.prepare('SELECT id, title, content FROM knowledge WHERE user_id = ? AND active = 1 ORDER BY id').all(userId);
  if (all.reduce((a, k) => a + k.title.length + k.content.length, 0) < 6000) return all;
  const words = searchWords(query);
  return all
    .map((k) => {
      const t = k.title.toLowerCase();
      const c = k.content.toLowerCase();
      return { ...k, score: words.reduce((a, w) => a + (t.includes(w) ? 3 : 0) + (c.includes(w) ? 1 : 0), 0) };
    })
    .filter((k) => k.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ------------------------------------------------------------------
// Customers & messages
// ------------------------------------------------------------------
export function getCustomer(pageId, psid) {
  return db.prepare('SELECT * FROM customers WHERE page_id = ? AND psid = ?').get(pageId, psid);
}

export async function createCustomer(userId, pageId, psid, { name = null, pic = null, isTest = 0 } = {}) {
  await db.prepare('INSERT OR IGNORE INTO customers (user_id, page_id, psid, name, profile_pic, is_test) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, pageId, psid, name, pic, isTest);
  return getCustomer(pageId, psid);
}

export async function saveMessage(customerId, { mid = null, direction, source, text, image_url = null }) {
  const r = await db
    .prepare('INSERT OR IGNORE INTO messages (customer_id, mid, direction, source, text, image_url) VALUES (?, ?, ?, ?, ?, ?)')
    .run(customerId, mid, direction, source, text, image_url);
  await db.prepare(`UPDATE customers SET last_message_at = datetime('now')${direction === 'in' ? ', unread = unread + 1' : ''} WHERE id = ?`)
    .run(customerId);
  return r.changes > 0;
}
