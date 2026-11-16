import fs from 'node:fs';
import path from 'node:path';
import { db, isRemoteDb } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server health for the admin panel (no SSH needed on cloud hosting)
export const GET = guard(async () => {
  const remote = isRemoteDb();
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const size = remote
    ? null
    : ['app.db', 'app.db-wal'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f)).reduce((a, f) => a + fs.statSync(f).size, 0);
  const count = async (t) => (await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()).c;
  return json({
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    database: remote ? 'Turso (অনলাইন ডাটাবেস)' : dir,
    // Data is safe on Turso, or on a mounted volume; a bare /tmp on serverless is not
    persistent: remote || (!!process.env.DATA_DIR && !process.env.VERCEL),
    dbSizeMb: size == null ? null : Math.round((size / 1048576) * 10) / 10,
    rows: { users: await count('users'), products: await count('products'), messages: await count('messages'), orders: await count('orders') },
  });
}, { admin: true });
