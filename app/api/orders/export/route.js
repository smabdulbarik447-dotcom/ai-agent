import { db } from '@/lib/db';
import { guard } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// All orders as a CSV file that opens in Excel (with Bangla) and can be bulk-uploaded to couriers
export const GET = guard(async (req, _p, user) => {
  const st = req.nextUrl.searchParams.get('status') || '';
  const orders = await db
    .prepare(`SELECT * FROM orders WHERE user_id = ? AND (? = '' OR status = ?) ORDER BY id DESC`)
    .all(user.id, st, st);
  const head = ['Invoice', 'Name', 'Phone', 'Address', 'Products', 'Subtotal', 'Delivery', 'COD Amount', 'Status', 'Tracking', 'Note', 'Date'];
  const rows = orders.map((o) => [
    `#${o.id}`, o.customer_name, o.phone, o.address,
    JSON.parse(o.items || '[]').map((i) => `${i.name} x${i.qty}`).join(', '),
    o.subtotal, o.delivery, o.total, o.status, o.tracking_code, o.note, o.created_at,
  ]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
