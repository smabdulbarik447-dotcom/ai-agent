import { db, getPlatform } from '@/lib/db';
import { activeSubscription } from '@/lib/billing';
import { learnStatus, runLearning } from '@/lib/learn';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// What the AI has learned so far + the background learning job's progress
export const GET = guard((_req, _p, user) => {
  const one = (sql) => db.prepare(sql).get(user.id).c;
  return json({
    status: learnStatus(user.id),
    aiReady: !!getPlatform().anthropic_api_key,
    counts: {
      products: one('SELECT COUNT(*) AS c FROM products WHERE user_id = ?'),
      fromWebsite: one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND source IN ('shopify','woocommerce','website','website-ai')"),
      fromFacebook: one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND source = 'facebook'"),
      withImage: one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND image IS NOT NULL AND image != ''"),
      imagesLearned: one("SELECT COUNT(*) AS c FROM products WHERE user_id = ? AND image_desc IS NOT NULL AND image_desc != ''"),
      postsRead: one('SELECT COUNT(*) AS c FROM fb_posts_seen WHERE user_id = ?'),
      knowledge: one('SELECT COUNT(*) AS c FROM knowledge WHERE user_id = ? AND active = 1'),
      pages: one('SELECT COUNT(*) AS c FROM pages WHERE user_id = ? AND active = 1'),
    },
  });
});

// "এখনই শেখাও": read Facebook posts + product photos in the background
export const POST = guard((_req, _p, user) => {
  if (!activeSubscription(user.id)) throw new Error('আপনার কোনো চালু প্ল্যান নেই। Billing থেকে একটি প্ল্যান কিনুন।');
  if (!getPlatform().anthropic_api_key) throw new Error('প্ল্যাটফর্মে AI এখনো চালু হয়নি (অ্যাডমিনকে জানান)');
  if (learnStatus(user.id).running) throw new Error('শেখা চলছে — একটু অপেক্ষা করুন');
  runLearning(user.id).catch((e) => console.error('[learn]', e.message));
  return json({ started: true });
});
