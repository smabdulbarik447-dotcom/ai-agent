import { db } from '@/lib/db';
import { approvePayment } from '@/lib/billing';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const PUT = guard(async (req, { id }) => {
  const { action, note = '' } = await body(req);
  if (action === 'approve') {
    (await approvePayment(Number(id)));
  } else if (action === 'reject') {
    const r = (await db.prepare("UPDATE payments SET status = 'rejected', note = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'").run(note, id));
    if (!r.changes) throw new Error('এই পেমেন্ট আগেই রিভিউ করা হয়েছে');
  } else {
    throw new Error('ভুল অ্যাকশন');
  }
  return json({ ok: true });
}, { admin: true });
