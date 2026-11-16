import { cookies } from 'next/headers';
import { json, endSession, userForToken, SESSION_COOKIE, ADMIN_BACK_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';

// End the "login as user" view and restore the admin's own session
export async function POST() {
  const back = (await cookies()).get(ADMIN_BACK_COOKIE)?.value;
  const admin = await userForToken(back);
  await endSession(); // the temporary user session
  const res = json({ ok: !!admin, role: admin?.role || null });
  res.cookies.set(ADMIN_BACK_COOKIE, '', { path: '/', maxAge: 0 });
  if (admin?.role === 'admin') {
    res.cookies.set(SESSION_COOKIE, back, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
  } else {
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  }
  return res;
}
