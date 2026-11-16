import { db } from '@/lib/db';
import { syncStatus } from '@/lib/scraper';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard(async (_req, _p, user) =>
  json({ ...(await syncStatus(user.id)), logs: (await db.prepare('SELECT * FROM sync_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(user.id)) })
);
