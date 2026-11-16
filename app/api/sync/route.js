import { after } from 'next/server';
import { getUserSettings, saveUserSettings } from '@/lib/db';
import { activeSubscription } from '@/lib/billing';
import { syncWebsite, syncStatus } from '@/lib/scraper';
import { runLearning } from '@/lib/learn';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 300; // the sync keeps running after the response

export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  if (b.url) (await saveUserSettings(user.id, { website_url: b.url }));
  if ((await syncStatus(user.id)).running) throw new Error('একটি সিঙ্ক ইতিমধ্যে চলছে');
  const sub = (await activeSubscription(user.id));
  if (!sub) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  if (!sub.website_sync) throw new Error(`${sub.plan_name} প্ল্যানে ওয়েবসাইট সিঙ্ক নেই। প্ল্যান আপগ্রেড করুন।`);
  // Runs after the response; the panel polls /api/sync/status. Then the AI looks at the new product photos.
  const url = b.url || (await getUserSettings(user.id)).website_url;
  after(() =>
    syncWebsite(user.id, url, { budgetMs: 200_000 })
      .then(() => runLearning(user.id, { pages: false, budgetMs: 80_000 }))
      .catch((e) => console.error('[sync]', e.message))
  );
  return json({ started: true });
});
