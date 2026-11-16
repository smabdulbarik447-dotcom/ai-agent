import { getUserSettings } from '@/lib/db';
import { connectPage } from '@/lib/pages';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

// Pick one of the pages returned by "Connect with Facebook"
export const POST = guard(async (req, _p, user) => {
  const { page_id } = await body(req);
  const opt = JSON.parse(getUserSettings(user.id).fb_page_options || '[]').find((o) => o.id === page_id);
  if (!opt) throw new Error('পেজটি পাওয়া যায়নি — আবার "Facebook দিয়ে কানেক্ট করুন" চাপুন');
  await connectPage(user.id, opt);
  return json({ ok: true });
});
