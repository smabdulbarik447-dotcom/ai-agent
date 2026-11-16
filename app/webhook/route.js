import { after } from 'next/server';
import { getPlatform } from '@/lib/db';
import { verifySignature } from '@/lib/facebook';
import { enqueue, handleCustomerMessage, handlePageEcho, pageForWebhook } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Facebook webhook verification (one webhook for every shop's page)
export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === getPlatform().fb_verify_token) {
    return new Response(sp.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Incoming Messenger events, routed to the shop that owns the page
export async function POST(req) {
  const raw = Buffer.from(await req.arrayBuffer());
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) return new Response('Bad signature', { status: 401 });

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  if (payload.object !== 'page') return new Response('OK');

  const jobs = [];
  for (const entry of payload.entry || []) {
    const page = pageForWebhook(String(entry.id));
    if (!page) continue; // page not connected, disabled, or owner suspended
    for (const ev of entry.messaging || []) {
      if (ev.message?.is_echo) {
        const psid = ev.recipient.id;
        jobs.push(enqueue(`${page.page_id}:${psid}`, () => handlePageEcho(page, psid, ev.message)));
        continue;
      }
      const psid = ev.sender?.id;
      if (!psid) continue;
      let text = null;
      let mid = null;
      if (ev.message) {
        mid = ev.message.mid;
        text = ev.message.text || ev.message.quick_reply?.payload || null;
        if (!text && ev.message.attachments?.length) {
          text = `[কাস্টমার একটি ${ev.message.attachments[0].type === 'image' ? 'ছবি' : 'অ্যাটাচমেন্ট'} পাঠিয়েছে]`;
        }
      } else if (ev.postback) {
        mid = ev.postback.mid || `pb-${ev.timestamp}-${psid}`;
        text = ev.postback.title || ev.postback.payload;
      }
      if (text) jobs.push(enqueue(`${page.page_id}:${psid}`, () => handleCustomerMessage(page, psid, mid, text)));
    }
  }
  // Answer Facebook right away (it retries slow webhooks); reply in the background
  after(() => Promise.all(jobs));
  return new Response('EVENT_RECEIVED');
}
