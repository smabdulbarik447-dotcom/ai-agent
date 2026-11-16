import { db } from '@/lib/db';
import { guard } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Download every table as one JSON file (works the same for the online and the local database)
export const GET = guard(async () => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const tables = await db.tables();
  const dump = { created_at: new Date().toISOString(), tables: {} };
  for (const t of tables) dump.tables[t] = await db.prepare(`SELECT * FROM "${t}"`).all();
  return new Response(JSON.stringify(dump), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="shobpaabo-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}, { admin: true });
