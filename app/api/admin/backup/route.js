import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from '@/lib/db';
import { guard } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Download a consistent copy of the whole database
export const GET = guard(() => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const tmp = path.join(os.tmpdir(), `shobpaabo-backup-${stamp}-${process.pid}.db`);
  db.exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);
  try {
    const file = fs.readFileSync(tmp);
    return new Response(file, {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="shobpaabo-backup-${stamp}.db"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}, { admin: true });
