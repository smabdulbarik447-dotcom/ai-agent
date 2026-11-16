import Anthropic from '@anthropic-ai/sdk';
import { getPlatform } from './db.js';

// The platform owner's key is used for every shop; usage is metered per plan.
export function getClient() {
  const key = getPlatform().anthropic_api_key;
  if (!key) return null;
  const cached = globalThis.__spAnthropic;
  if (cached?.key === key) return cached.client;
  const client = new Anthropic({ apiKey: key });
  globalThis.__spAnthropic = { key, client };
  return client;
}

// One Messages API call with server-side refusal fallbacks enabled.
export async function createMessage(params) {
  const client = getClient();
  if (!client) throw new Error('প্ল্যাটফর্মে Claude API key সেট করা নেই (অ্যাডমিনকে জানান)');
  const p = getPlatform();
  const { output_config, ...rest } = params;
  return client.beta.messages.create({
    model: p.ai_model || 'claude-opus-5-5',
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    ...rest,
    output_config: { effort: p.ai_effort || 'low', ...output_config },
  });
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
