import { db } from '@/lib/db';
import { guard, json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Recent post comments the bot answered
export const GET = guard(async (_req, _p, user) =>
  json(
    await db
      .prepare(
        `SELECT r.*, (SELECT name FROM pages WHERE page_id = r.page_id) AS page_name
         FROM comment_replies r WHERE r.user_id = ? ORDER BY r.id DESC LIMIT 50`
      )
      .all(user.id)
  )
);
