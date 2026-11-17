import { scheduledTick } from '@/lib/scraper';
import { json } from '@/lib/api';
import { followupTick } from '@/lib/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Vercel Cron calls this (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401);
  await followupTick({ budgetMs: 30_000 });
  await scheduledTick({ budgetMs: 240_000 });
  return json({ ok: true });
}
