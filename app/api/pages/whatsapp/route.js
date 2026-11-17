import { connectWhatsApp } from '@/lib/pages';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Connect a WhatsApp Business number with its Phone Number ID, WABA ID and permanent token
export const POST = guard(async (req, _p, user) => {
  const b = await body(req);
  const r = await connectWhatsApp(user.id, b);
  return json({ ok: true, name: r.name });
});
