import { readImage } from '@/lib/images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public product photo (no login): Messenger / WhatsApp download it by this link
export async function GET(_req, { params }) {
  const id = String((await params).id || '').replace(/\.\w+$/, '');
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response('Not found', { status: 404 });
  const img = await readImage(id);
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(img.data, 'base64'), {
    headers: {
      'Content-Type': img.mime,
      'Cache-Control': 'public, max-age=31536000, immutable', // the id never points to a different photo
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
