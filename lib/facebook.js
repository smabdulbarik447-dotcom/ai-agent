import crypto from 'node:crypto';
import { getPlatform } from './db.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
export const BOT_MARK = 'shobpaabo-bot';
// Always needed: list the user's pages, send/receive Messenger messages, subscribe the webhook
const BASE_SCOPES = ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'];

/** Permissions to request. Extras are opt-in because Facebook refuses the whole login if the app lacks one. */
export async function fbScopes() {
  const p = await getPlatform();
  const scopes = [...BASE_SCOPES];
  if (p.fb_scope_posts === '1' || p.fb_scope_comments === '1') scopes.push('pages_read_engagement');
  if (p.fb_scope_comments === '1') scopes.push('pages_read_user_content', 'pages_manage_engagement');
  return scopes.join(',');
}

// All shops connect through the platform owner's single Meta app
export async function verifySignature(rawBody, signatureHeader) {
  const { fb_app_secret } = await getPlatform();
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
/**
 * Send a text message. `tag: 'POST_PURCHASE_UPDATE'` lets order updates reach the customer
 * even after Messenger's 24-hour reply window (Meta allows this tag only for order/shipping updates).
 */
export async function sendText(token, psid, text, { tag, quick } = {}) {
  const ids = [];
  const parts = chunks(text);
  for (const [i, part] of parts.entries()) {
    // tap-to-answer buttons go under the last part
    const qr = quick?.length && i === parts.length - 1
      ? { quick_replies: quick.map((q) => ({ content_type: 'text', title: q.title, payload: q.payload })) }
      : {};
    const r = await graph('/me/messages', {
      token,
      method: 'POST',
      body: {
        recipient: { id: psid },
        ...(tag ? { messaging_type: 'MESSAGE_TAG', tag } : { messaging_type: 'RESPONSE' }),
        message: { text: part, metadata: BOT_MARK, ...qr },
      },
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
/** Deliver this page's messages (and post comments, when allowed) to our webhook */
export async function subscribePage(pageId, token) {
  const base = 'messages,messaging_postbacks,message_echoes';
  try {
    return await graph(`/${pageId}/subscribed_apps?subscribed_fields=${base},feed`, { token, method: 'POST' });
  } catch {
    // no comment permission yet: messages still work
    return graph(`/${pageId}/subscribed_apps?subscribed_fields=${base}`, { token, method: 'POST' });
  }
}

export const unsubscribePage = (pageId, token) =>
  graph(`/${pageId}/subscribed_apps`, { token, method: 'DELETE' }).catch(() => {});

// ---------- "Connect with Facebook" (OAuth) ----------
export async function oauthUrl(redirectUri, state) {
  const { fb_app_id } = await getPlatform();
  const q = new URLSearchParams({ client_id: fb_app_id, redirect_uri: redirectUri, state, scope: await fbScopes(), response_type: 'code' });
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
}

/** Code -> long-lived user token -> the user's pages with (non-expiring) page tokens */
export async function pagesFromCode(code, redirectUri) {
  const { fb_app_id, fb_app_secret } = await getPlatform();
  const short = await graph(
    `/oauth/access_token?${new URLSearchParams({ client_id: fb_app_id, client_secret: fb_app_secret, redirect_uri: redirectUri, code })}`
  );
  const long = await graph(
    `/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: fb_app_id, client_secret: fb_app_secret, fb_exchange_token: short.access_token })}`
  );
  const pages = await graph('/me/accounts?fields=id,name,access_token&limit=100', { token: long.access_token });
  return pages.data || [];
}

// ---------- Post comments ----------
export const getPost = (postId, token) => graph(`/${postId}?fields=message,full_picture,permalink_url`, { token });

/** Public reply under a comment */
export const replyToComment = (commentId, token, message) =>
  graph(`/${commentId}/comments`, { token, method: 'POST', body: { message } });

/** "Private reply": opens a Messenger chat with the person who commented */
export const privateReply = (commentId, token, text) =>
  graph('/me/messages', { token, method: 'POST', body: { recipient: { comment_id: commentId }, message: { text, metadata: BOT_MARK } } });
