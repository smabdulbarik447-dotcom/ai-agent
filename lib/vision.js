import { createMessage, textOf } from './ai.js';

const MAX_BYTES = 4.5 * 1024 * 1024; // API limit is 5MB per image

function mediaType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/**
 * An image as a Claude content block, from an http(s) URL (website, Facebook CDN)
 * or a data: URL (test-chat upload). Returns null when it can't be used.
 */
export async function imageBlock(src) {
  try {
    let buf;
    if (String(src).startsWith('data:')) {
      buf = Buffer.from(String(src).split(',')[1] || '', 'base64');
    } else {
      const res = await fetch(src, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShobPaaboBot/1.0)' } });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }
    const type = mediaType(buf);
    if (!type || buf.length > MAX_BYTES) return null;
    return { type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } };
  } catch {
    return null;
  }
}

const DESC_SCHEMA = {
  type: 'object',
  properties: { description: { type: 'string' } },
  required: ['description'],
  additionalProperties: false,
};

/** One-paragraph visual description of a product photo, used to match customer screenshots. */
export async function describeProductImage(url, name, userId) {
  const img = await imageBlock(url);
  if (!img) return null;
  const response = await createMessage({
    max_tokens: 800,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: DESC_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        img,
        {
          type: 'text',
          text: `This is the photo of the product "${name}". Describe what is visible so the product can be recognised later from a customer's screenshot: product type, brand and any text or logo on it, colours, pattern, material, shape, packaging, size/volume if shown. One short paragraph in English, then the main keywords in Bangla.`,
        },
      ],
    }],
  }, { userId });
  if (response.stop_reason === 'refusal') return null;
  return JSON.parse(textOf(response) || '{}').description || null;
}
