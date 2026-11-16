import crypto from 'node:crypto';
import { getPlatform } from './db.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
export const BOT_MARK = 'shobpaabo-bot';
export const FB_SCOPES = 'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement';

// All shops connect through the platform owner's single Meta app
export function verifySignature(rawBody, signatureHeader) {
  const { fb_app_secret } = getPlatform();
  if (!fb_app_secret) return true; // not configured yet - skip check
  if (!signatureHeader || !rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', fb_app_secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function graph(pathname, { token, method = 'GET', body } = {}) {
  const sep = pathname.includes('?') ? '&' : '?';
  const url = `${GRAPH}${pathname}${token ? `${sep}access_token=${encodeURIComponent(token)}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API error ${res.status}`);
  return data;
}

// Messenger caps a text message at 2000 characters
function chunks(text, size = 1900) {
  const out = [];
  let rest = String(text);
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

// `metadata` comes back on the echo webhook, so we can tell bot replies from human ones
export async function sendText(token, psid, text) {
  const ids = [];
  for (const part of chunks(text)) {
    const r = await graph('/me/messages', {
      token,
      method: 'POST',
      body: { recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: part, metadata: BOT_MARK } },
    });
    ids.push(r.message_id);
  }
  return ids;
}

export async function senderAction(token, psid, action) {
  try {
    await graph('/me/messages', { token, method: 'POST', body: { recipient: { id: psid }, sender_action: action } });
  } catch {
    /* typing indicators are best-effort */
  }
}

export async function getUserProfile(token, psid) {
  try {
    return await graph(`/${psid}?fields=first_name,last_name,profile_pic`, { token });
  } catch {
    return null; // needs extra permission on some pages
  }
}

export const getPageInfo = (token) => graph('/me?fields=id,name', { token });

/** The page's own posts (newest first) with caption, main photo and link. */
export async function getPagePosts(pageId, token, max = 200) {
  const out = [];
  let url = `${GRAPH}/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=50&access_token=${encodeURIComponent(token)}`;
  while (url && out.length < max) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API error ${res.status}`);
    out.push(...(data.data || []));
    url = data.paging?.next;
  }
  return out.slice(0, max);
}

export async function sendImage(token, psid, imageUrl) {
  return graph('/me/messages', {
    token,
    method: 'POST',
    body: { recipient: { id: psid }, messaging_type: 'RESPONSE', message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } }, metadata: BOT_MARK } },
  });
}

// Ask Facebook to deliver this page's messages to our webhook
export const subscribePage = (pageId, token) =>
  graph(`/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes`, { token, method: 'POST' });

export const unsubscribePage = (pageId, token) =>
  graph(`/${pageId}/subscribed_apps`, { token, method: 'DELETE' }).catch(() => {});

// ---------- "Connect with Facebook" (OAuth) ----------
export function oauthUrl(redirectUri, state) {
  const { fb_app_id } = getPlatform();
  const q = new URLSearchParams({ client_id: fb_app_id, redirect_uri: redirectUri, state, scope: FB_SCOPES, response_type: 'code' });
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
}

/** Code -> long-lived user token -> the user's pages with (non-expiring) page tokens */
export async function pagesFromCode(code, redirectUri) {
  const { fb_app_id, fb_app_secret } = getPlatform();
  const short = await graph(
    `/oauth/access_token?${new URLSearchParams({ client_id: fb_app_id, client_secret: fb_app_secret, redirect_uri: redirectUri, code })}`
  );
  const long = await graph(
    `/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: fb_app_id, client_secret: fb_app_secret, fb_exchange_token: short.access_token })}`
  );
  const pages = await graph('/me/accounts?fields=id,name,access_token&limit=100', { token: long.access_token });
  return pages.data || [];
}
