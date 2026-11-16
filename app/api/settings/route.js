import { getUserSettings, saveUserSettings } from '@/lib/db';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The shop's own settings (bot behaviour, business info, sync)
export const GET = guard((_req, _p, user) => {
  const { fb_page_options, ...s } = getUserSettings(user.id);
  return json(s);
});

export const PUT = guard(async (req, _p, user) => {
  const { fb_page_options, ...b } = await body(req);
  saveUserSettings(user.id, b);
  return json({ ok: true });
});
