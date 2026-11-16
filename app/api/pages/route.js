import { db, getPlatform, getUserSettings } from '@/lib/db';
import { activeSubscription } from '@/lib/billing';
import { getPageInfo } from '@/lib/facebook';
import { connectPage } from '@/lib/pages';
import { guard, json, body, publicUrl } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = guard((req, _p, user) => {
  const p = getPlatform();
  const connected = db.prepare('SELECT id, page_id, name, active, created_at FROM pages WHERE user_id = ? ORDER BY id').all(user.id);
  const ids = new Set(connected.map((x) => x.page_id));
  // Pages from the last Facebook login that aren't connected yet (tokens stay on the server)
  const options = JSON.parse(getUserSettings(user.id).fb_page_options || '[]')
    .filter((o) => !ids.has(o.id))
    .map(({ id, name }) => ({ id, name }));
  return json({
    pages: connected,
    options,
    oauth: !!(p.fb_app_id && p.fb_app_secret),
    maxPages: activeSubscription(user.id)?.max_pages ?? 0,
    oauthRedirect: `${p.public_url || publicUrl(req)}/api/fb/callback`,
  });
});

// Manual connection with a Page Access Token (from the platform's Meta app)
export const POST = guard(async (req, _p, user) => {
  const token = String((await body(req)).token || '').trim();
  if (!token) throw new Error('Page Access Token দিন');
  let info;
  try {
    info = await getPageInfo(token);
  } catch (e) {
    throw new Error('টোকেনটি কাজ করছে না: ' + e.message);
  }
  await connectPage(user.id, { id: info.id, name: info.name, access_token: token });
  return json({ ok: true, page: { id: info.id, name: info.name } });
});
