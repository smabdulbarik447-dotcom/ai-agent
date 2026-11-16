import { after } from 'next/server';
import { db, getPlatform } from '@/lib/db';
import { activeSubscription } from '@/lib/billing';
import { learnStatus, runLearning } from '@/lib/learn';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // learning keeps running after the response

// What the AI has learned so far + the background learning job's progress
export const GET = guard(async (_req, _p, user) => {
  const one = async (sql) => (await db.prepare(sql).get(user.id)).c;
  return json({
    status: (await learnStatus(user.id)),
    aiReady: !!(await getPlatform()).anthropic_api_key,
    counts: {
      products: (await one('SELECT COUNT(*) AS c FROM products WHERE user_id = ?')),
      fromWebsite: (await one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND source IN ('shopify','woocommerce','website','website-ai')")),
      fromFacebook: (await one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND source = 'facebook'")),
      withImage: (await one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND image IS NOT NULL AND image != ''")),
      imagesLearned: (await one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND image_desc IS NOT NULL AND image_desc != ''")),
      postsRead: (await one('SELECT COUNT(*) AS c FROM fb_posts_seen WHERE user_id = ?')),
      knowledge: (await one('SELECT COUNT(*) AS c FROM knowledge WHERE user_id = ? AND active = 1')),
      pages: (await one('SELECT COUNT(*) AS c FROM pages WHERE user_id = ? AND active = 1')),
    },
  });
});

// "এখনই শেখাও": read Facebook posts + product photos in the background
export const POST = guard(async (_req, _p, user) => {
  if (!(await activeSubscription(user.id))) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  if (!(await getPlatform()).anthropic_api_key) throw new Error('প্ল্যাটফর্মে AI এখনো চালু হয়নি (অ্যাডমিনকে জানান)');
  if ((await learnStatus(user.id)).running) throw new Error('শেখা চলছে — একটু অপেক্ষা করুন');
  after(() => runLearning(user.id, { budgetMs: 270_000 }).catch((e) => console.error('[learn]', e.message)));
  return json({ started: true });
});
