import { after } from 'next/server';
import { getUserSettings } from '@/lib/db';
import { connectPage } from '@/lib/pages';
import { runLearning } from '@/lib/learn';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 300; // the page's posts are read right after connecting

// Pick one of the pages returned by "Connect with Facebook"
export const POST = guard(async (req, _p, user) => {
  const { page_id } = await body(req);
  const opt = JSON.parse((await getUserSettings(user.id)).fb_page_options || '[]').find((o) => o.id === page_id);
  if (!opt) throw new Error('পেজটি পাওয়া যায়নি — আবার "Facebook দিয়ে কানেক্ট করুন" চাপুন');
  await connectPage(user.id, opt);
  // Start reading the page's posts and photos right away
  after(() => runLearning(user.id, { budgetMs: 270_000 }).catch((e) => console.error('[learn]', e.message)));
  return json({ ok: true });
});
