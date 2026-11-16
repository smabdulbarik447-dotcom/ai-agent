import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server health for the admin panel (no SSH needed on cloud hosting)
export const GET = guard(() => {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const size = ['app.db', 'app.db-wal']
    .map((f) => path.join(dir, f))
    .filter((f) => fs.existsSync(f))
    .reduce((a, f) => a + fs.statSync(f).size, 0);
  const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  return json({
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    dataDir: dir,
    persistentDir: !!process.env.DATA_DIR,
    dbSizeMb: Math.round((size / 1048576) * 10) / 10,
    rows: { users: count('users'), products: count('products'), messages: count('messages'), orders: count('orders') },
  });
}, { admin: true });
