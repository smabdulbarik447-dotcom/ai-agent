// One way to message a customer, whether the shop's channel is a Facebook page or a WhatsApp number
import { sendText, sendImage, senderAction } from './facebook.js';
import { waSendText, waSendImage } from './whatsapp.js';

export const isWhatsApp = (page) => page?.channel === 'whatsapp';

/** Returns the sent message ids. `tag` only applies to Messenger. */
export function sendTextTo(page, to, text, opts = {}) {
  return isWhatsApp(page) ? waSendText(page, to, text, opts) : sendText(page.access_token, to, text, opts);
}

export function sendImageTo(page, to, url) {
  return isWhatsApp(page) ? waSendImage(page, to, url) : sendImage(page.access_token, to, url);
}

/** Messenger typing dots / seen (WhatsApp has no typing indicator for businesses) */
export function actionTo(page, to, action) {
  if (!isWhatsApp(page)) senderAction(page.access_token, to, action);
}
