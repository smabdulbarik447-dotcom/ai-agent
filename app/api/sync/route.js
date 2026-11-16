import { getUserSettings, saveUserSettings } from '@/lib/db';
import { activeSubscription } from '@/lib/billing';
import { syncWebsite, syncStatus } from '@/lib/scraper';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  if (b.url) saveUserSettings(user.id, { website_url: b.url });
  if (syncStatus(user.id).running) throw new Error('একটি সিঙ্ক ইতিমধ্যে চলছে');
  const sub = activeSubscription(user.id);
  if (!sub) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  if (!sub.website_sync) throw new Error(`${sub.plan_name} প্ল্যানে ওয়েবসাইট সিঙ্ক নেই। প্ল্যান আপগ্রেড করুন।`);
  // Runs in the background; the panel polls /api/sync/status
  syncWebsite(user.id, b.url || getUserSettings(user.id).website_url).catch((e) => console.error('[sync]', e.message));
  return json({ started: true });
});
