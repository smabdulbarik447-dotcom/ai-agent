import { getUserSettings, saveUserSettings } from '@/lib/db';
import { guard, json, body } from '@/lib/api';
import { followupStats } from '@/lib/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET_KEYS = ['steadfast_api_key', 'steadfast_secret_key'];
const mask = (v) => (v ? `••••••${v.slice(-4)}` : '');

// The shop's own settings (bot behaviour, business info, sync, courier)
export const GET = guard(async (_req, _p, user) => {
  const { fb_page_options, ...s } = await getUserSettings(user.id);
  for (const k of SECRET_KEYS) s[k] = mask(s[k]);
  s.followup_stats = await followupStats(user.id).catch(() => ({ sent: 0, won: 0 }));
  return json(s);
});

export const PUT = guard(async (req, _p, user) => {
  const { fb_page_options, followup_stats, ...b } = await body(req);
  // Masked values mean "unchanged"
  for (const k of SECRET_KEYS) if (typeof b[k] === 'string' && b[k].startsWith('••••')) delete b[k];
  await saveUserSettings(user.id, b);
  return json({ ok: true });
});
