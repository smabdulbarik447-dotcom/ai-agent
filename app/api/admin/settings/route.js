import { getPlatform, savePlatform } from '@/lib/db';
import { guard, json, body, publicUrl } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET_KEYS = ['fb_app_secret', 'anthropic_api_key'];
const mask = (v) => (v ? `••••••${v.slice(-4)}` : '');

export const GET = guard(async (req) => {
  const s = (await getPlatform());
  for (const k of SECRET_KEYS) s[k] = mask(s[k]);
  const base = s.public_url || publicUrl(req);
  s.webhook_url = `${base}/webhook`;
  s.oauth_redirect = `${base}/api/fb/callback`;
  return json(s);
}, { admin: true });

export const PUT = guard(async (req) => {
  const b = await body(req);
  // Masked values mean "unchanged"
  for (const k of SECRET_KEYS) if (typeof b[k] === 'string' && b[k].startsWith('••••')) delete b[k];
  if (b.public_url) b.public_url = String(b.public_url).trim().replace(/\/+$/, '');
  (await savePlatform(b));
  return json({ ok: true });
}, { admin: true });
