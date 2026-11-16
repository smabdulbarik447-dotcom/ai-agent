import Anthropic from '@anthropic-ai/sdk';
import { db, getPlatform } from './db.js';

// USD per million tokens [input, output] — used only to show the admin an estimated cost
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

// The platform owner's key is used for every shop; usage is metered per plan.
export async function getClient() {
  const key = (await getPlatform()).anthropic_api_key;
  if (!key) return null;
  const cached = globalThis.__spAnthropic;
  if (cached?.key === key) return cached.client;
  const client = new Anthropic({ apiKey: key });
  globalThis.__spAnthropic = { key, client };
  return client;
}

/** Add this call's tokens and estimated cost to the shop's monthly usage. */
async function recordUsage(userId, model, usage) {
  if (!userId || !usage) return;
  // With fallbacks, every attempt is listed in `iterations`; otherwise the top-level numbers are the whole call
  const parts = usage.iterations?.length ? usage.iterations : [usage];
  const input = parts.reduce((a, u) => a + (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), 0);
  const output = parts.reduce((a, u) => a + (u.output_tokens || 0), 0);
  const [pin, pout] = PRICES[model] || PRICES['claude-opus-5-5'];
  const cost = (input * pin + output * pout) / 1e6;
  const month = new Date().toISOString().slice(0, 7);
  await db
    .prepare(
      `INSERT INTO usage (user_id, month, ai_replies, input_tokens, output_tokens, cost_usd) VALUES (?, ?, 0, ?, ?, ?)
       ON CONFLICT(user_id, month) DO UPDATE SET input_tokens = usage.input_tokens + excluded.input_tokens,
         output_tokens = usage.output_tokens + excluded.output_tokens, cost_usd = usage.cost_usd + excluded.cost_usd`
    )
    .run(userId, month, input, output, cost)
    .catch((e) => console.error('[usage]', e.message));
}

/**
 * One Messages API call with server-side refusal fallbacks enabled.
 * Pass `{ userId }` so the call's cost is counted for that shop.
 */
export async function createMessage(params, { userId } = {}) {
  const client = await getClient();
  if (!client) throw new Error('প্ল্যাটফর্মে Claude API key সেট করা নেই (অ্যাডমিনকে জানান)');
  const p = await getPlatform();
  const model = p.ai_model || 'claude-opus-5-5';
  const { output_config, ...rest } = params;
  const response = await client.beta.messages.create({
    model,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    ...rest,
    output_config: { effort: p.ai_effort || 'low', ...output_config },
  });
  await recordUsage(userId, model, response.usage);
  return response;
}

export function textOf(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// After a mid-output fallback, only blocks after the last `fallback` marker
// (plus earlier text) may be echoed back.
export function echoableContent(content) {
  const last = content.map((b) => b.type).lastIndexOf('fallback');
  if (last === -1) return content;
  return [...content.slice(0, last).filter((b) => b.type === 'text'), ...content.slice(last + 1)];
}
