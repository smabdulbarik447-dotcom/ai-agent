import { db, getUserSettings, searchProducts } from './db.js';
import { createMessage, textOf } from './ai.js';
import { activeSubscription, canUseAi, countAiReply } from './billing.js';
import { getPost, replyToComment, privateReply } from './facebook.js';
import { fillPlaceholders } from './agent.js';

const priceLine = (p) =>
  `${p.name}: ৳${p.price ?? '?'}${p.regular_price && p.regular_price > p.price ? ` (আগের দাম ৳${p.regular_price})` : ''}${
    p.stock_status === 'out_of_stock' ? ' — এখন স্টকে নেই' : ''
  }`;

/** Products the post is about: the ones learned from this post, else a search on its caption. */
async function productsForPost(userId, postId, caption) {
  const fromPost = await db.prepare("SELECT * FROM products WHERE user_id = ? AND source_key LIKE ? AND active = 1").all(userId, `fb:${postId}#%`);
  if (fromPost.length) return fromPost;
  return caption ? (await searchProducts(userId, caption, 3)).filter((p) => p.score >= 3) : [];
}

/** Short Messenger message answering the comment (AI when available, else a template). */
async function writeAnswer({ userId, s, name, comment, caption, products }) {
  if (s.ai_enabled === '1' && (await canUseAi(userId))) {
    try {
      const response = await createMessage({
        max_tokens: 1000,
        system: `তুমি "${s.business_name || 'আমাদের দোকান'}" এর Facebook পেজের সেলস এজেন্ট। একজন কাস্টমার পেজের একটি পোস্টে কমেন্ট করেছে; তাকে Messenger এ প্রথম মেসেজ লিখছ।
- ৩-৪ লাইনের মধ্যে, বন্ধুসুলভ, কোনো markdown নয়। কাস্টমার যে ভাষায় কমেন্ট করেছে সেই ভাষায়।
- দাম/স্টক শুধু নিচের প্রোডাক্ট তালিকা থেকে বলবে, বানিয়ে বলবে না। তালিকা খালি হলে জিজ্ঞেস করবে কোন প্রোডাক্ট সম্পর্কে জানতে চায়।
- ডেলিভারি: ঢাকার ভিতরে ৳${s.delivery_inside_dhaka}, বাইরে ৳${s.delivery_outside_dhaka}। পেমেন্ট: ${s.payment_methods}।
- শেষে অর্ডার করতে নাম, ফোন ও ঠিকানা দিতে বলবে।`,
        messages: [{
          role: 'user',
          content: `পোস্টের লেখা: """${caption || '(নেই)'}"""
প্রোডাক্ট: ${products.length ? products.map(priceLine).join('; ') : '(পাওয়া যায়নি)'}
কাস্টমারের নাম: ${name || 'অজানা'}
কমেন্ট: """${comment}"""`,
        }],
      }, { userId });
      const text = response.stop_reason === 'refusal' ? '' : textOf(response);
      if (text) {
        await countAiReply(userId);
        return text;
      }
    } catch (e) {
      console.error(`[comment] user ${userId} AI failed:`, e.message);
    }
  }
  const hello = `আসসালামু আলাইকুম${name ? ` ${name}` : ''}! কমেন্টের জন্য ধন্যবাদ 😊`;
  if (!products.length) return `${hello}\nকোন প্রোডাক্ট সম্পর্কে জানতে চান লিখুন, আমরা বিস্তারিত জানিয়ে দেব।`;
  return `${hello}\n${products.map(priceLine).join('\n')}\nঅর্ডার করতে নাম, মোবাইল নম্বর ও ঠিকানা লিখে পাঠান।`;
}

/**
 * A new comment on a connected page's post (webhook "feed" change).
 * Replies publicly and, when enabled, sends the details privately in Messenger.
 */
export async function handleComment(page, v) {
  if (v.item !== 'comment' || v.verb !== 'add') return;
  if (!v.comment_id || !v.message?.trim()) return;
  if (v.from?.id === page.page_id) return; // the page's own reply
  if (v.parent_id && v.parent_id !== v.post_id) return; // replies inside a comment thread
  const userId = page.user_id;
  const s = await getUserSettings(userId);
  if (s.comment_reply_enabled !== '1' || !(await activeSubscription(userId))) return;

  // One answer per comment, even when Facebook delivers the event twice
  const claimed = await db
    .prepare('INSERT OR IGNORE INTO comment_replies (user_id, page_id, comment_id, post_id, from_name, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, page.page_id, v.comment_id, v.post_id, v.from?.name || null, v.message.slice(0, 2000));
  if (!claimed.changes) return;

  const name = (v.from?.name || '').split(' ')[0];
  const post = await getPost(v.post_id, page.access_token).catch(() => null);
  const products = await productsForPost(userId, v.post_id, post?.message || '');
  const answer = await writeAnswer({ userId, s, name, comment: v.message, caption: post?.message || '', products });

  // The log keeps what the bot wrote even if Facebook refused it, so the owner can see it
  const errors = [];
  let dmText = null;
  let publicText;
  if (s.comment_dm_enabled === '1') {
    dmText = answer;
    let dmSent = false;
    try {
      await privateReply(v.comment_id, page.access_token, answer);
      dmSent = true;
    } catch (e) {
      errors.push(`ইনবক্স: ${e.message}`);
    }
    publicText = dmSent ? fillPlaceholders(s.comment_public_reply, { name }, s) : answer;
  } else {
    publicText = answer; // no private message: answer right under the comment
  }
  try {
    await replyToComment(v.comment_id, page.access_token, publicText);
  } catch (e) {
    errors.push(`কমেন্ট: ${e.message}`);
  }
  await db
    .prepare('UPDATE comment_replies SET public_reply = ?, dm_text = ?, error = ? WHERE comment_id = ?')
    .run(publicText, dmText, errors.join(' | ') || null, v.comment_id);
}
