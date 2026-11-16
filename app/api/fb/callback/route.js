import { NextResponse } from 'next/server';
import { getPlatform, saveUserSettings } from '@/lib/db';
import { pagesFromCode } from '@/lib/facebook';
import { currentUser, publicUrl } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Step 2: Facebook sends the user back here with a code; we fetch their pages
export async function GET(req) {
  const base = (await getPlatform()).public_url || publicUrl(req);
  const back = (q) => {
    const res = NextResponse.redirect(`${base}/dashboard/pages${q}`);
    res.cookies.set('fb_state', '', { path: '/', maxAge: 0 });
    return res;
  };
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);

  const sp = req.nextUrl.searchParams;
  if (sp.get('error')) return back('?error=' + encodeURIComponent('Facebook কানেকশন বাতিল করা হয়েছে'));
  if (!sp.get('state') || sp.get('state') !== req.cookies.get('fb_state')?.value) {
    return back('?error=' + encodeURIComponent('সেশন মেয়াদোত্তীর্ণ — আবার চেষ্টা করুন'));
  }
  try {
    const pages = await pagesFromCode(sp.get('code'), `${base}/api/fb/callback`);
    if (!pages.length) return back('?error=' + encodeURIComponent('কোনো পেজ পাওয়া যায়নি। Facebook এ পেজ সিলেক্ট করে পারমিশন দিন।'));
    (await saveUserSettings(user.id, { fb_page_options: JSON.stringify(pages.map(({ id, name, access_token }) => ({ id, name, access_token }))) }));
    return back('?choose=1');
  } catch (e) {
    return back('?error=' + encodeURIComponent(e.message));
  }
}
