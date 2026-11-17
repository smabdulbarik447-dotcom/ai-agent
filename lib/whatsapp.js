// WhatsApp Business (Meta Cloud API). A shop's number is stored in `pages` with channel = 'whatsapp':
// page_id = Phone Number ID, access_token = permanent token, waba_id, app_secret (their Meta app, optional).
const GRAPH = process.env.GRAPH_BASE_URL || 'https://graph.facebook.com/v21.0'; // overridable for local tests

async function wa(pathname, token, { method = 'GET', body } = {}) {
  const res = await fetch(GRAPH + pathname, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `WhatsApp API error ${res.status}`);
  return data;
}

const send = (page, to, message) =>
  wa(`/${page.page_id}/messages`, page.access_token, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...message } })
    .then((r) => r.messages?.[0]?.id || null);

// WhatsApp allows 4096 characters per text and 1024 in a message with buttons
function chunks(text, size) {
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

/** Send text; `quick` buttons ({title, payload}, max 3) become WhatsApp reply buttons under the last part. */
export async function waSendText(page, to, text, { quick } = {}) {
  const ids = [];
  const buttons = (quick || []).slice(0, 3).map((q) => ({ type: 'reply', reply: { id: q.payload.slice(0, 256), title: q.title.slice(0, 20) } }));
  const parts = chunks(text, 4000);
  let last = buttons.length ? parts.pop() : null;
  for (const part of parts) ids.push(await send(page, to, { type: 'text', text: { body: part, preview_url: true } }));
  if (last != null) {
    if (last.length > 1000) {
      ids.push(await send(page, to, { type: 'text', text: { body: last } }));
      last = 'নিচের বাটন থেকে বেছে নিন 👇';
    }
    ids.push(await send(page, to, { type: 'interactive', interactive: { type: 'button', body: { text: last }, action: { buttons } } }));
  }
  return ids;
}

export const waSendImage = (page, to, url) => send(page, to, { type: 'image', image: { link: url } }).then((id) => ({ message_id: id }));

/** Blue ticks: tell the customer we've read their message */
export async function waMarkRead(page, messageId) {
  try {
    await wa(`/${page.page_id}/messages`, page.access_token, { method: 'POST', body: { messaging_product: 'whatsapp', status: 'read', message_id: messageId } });
  } catch {
    /* best effort */
  }
}

/** The number's display name, to check the ID and token before saving */
export const waPhoneInfo = (phoneId, token) => wa(`/${phoneId}?fields=display_phone_number,verified_name`, token);

/** Ask Meta to send this WhatsApp account's messages to our webhook */
export const waSubscribe = (wabaId, token) => wa(`/${wabaId}/subscribed_apps`, token, { method: 'POST' });

/** Photo a customer sent: download it (needs the token) and keep it as a data: URL */
export async function waMediaDataUrl(mediaId, token) {
  const meta = await wa(`/${mediaId}`, token);
  if (!meta.url) return null;
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 4_500_000) return null;
  return `data:${meta.mime_type || 'image/jpeg'};base64,${buf.toString('base64')}`;
}

/**
 * Turn one webhook "value" into customer messages:
 * [{ phoneId, from, name, mid, text, payload, mediaId }]
 */
export function waIncoming(value) {
  const phoneId = String(value?.metadata?.phone_number_id || '');
  const names = Object.fromEntries((value?.contacts || []).map((c) => [c.wa_id, c.profile?.name || null]));
  const out = [];
  for (const m of value?.messages || []) {
    let text = null;
    let payload = null;
    let mediaId = null;
    if (m.type === 'text') text = m.text?.body || null;
    else if (m.type === 'interactive') {
      const r = m.interactive?.button_reply || m.interactive?.list_reply;
      text = r?.title || null;
      payload = r?.id || null;
    } else if (m.type === 'button') {
      text = m.button?.text || null;
      payload = m.button?.payload || null;
    } else if (m.type === 'image') {
      mediaId = m.image?.id || null;
      text = m.image?.caption || null;
    } else if (m.type === 'sticker' || m.type === 'reaction') text = '👍';
    else text = '[কাস্টমার একটি অ্যাটাচমেন্ট পাঠিয়েছে]';
    if (text || mediaId) out.push({ phoneId, from: m.from, name: names[m.from] || null, mid: m.id, text, payload, mediaId });
  }
  return out;
}
