import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPlatform } from '@/lib/db';
import { oauthUrl } from '@/lib/facebook';
import { currentUser, publicUrl } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Step 1 of "Connect with Facebook": send the user to Facebook's login dialog
export async function GET(req) {
  const base = getPlatform().public_url || publicUrl(req);
  if (!(await currentUser())) return NextResponse.redirect(`${base}/login`);
  if (!getPlatform().fb_app_id) return NextResponse.redirect(`${base}/dashboard/pages?error=` + encodeURIComponent('অ্যাডমিন এখনো Facebook App সেট করেননি'));
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(oauthUrl(`${base}/api/fb/callback`, state));
  res.cookies.set('fb_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
