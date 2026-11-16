import { json, endSession, SESSION_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST() {
  await endSession();
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
