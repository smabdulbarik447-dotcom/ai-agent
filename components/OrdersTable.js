'use client';

import { useState } from 'react';
import { api, money, toast, when, STATUS } from '@/lib/client';

const RISK = {
  high: ['risk-high', '⚠ ফেক অর্ডারের ঝুঁকি'],
  medium: ['risk-medium', '⚠ আগে বাতিল/রিটার্ন আছে'],
  good: ['risk-good', '✓ বিশ্বস্ত কাস্টমার'],
  new: ['risk-new', 'নতুন কাস্টমার'],
};

function RiskBadge({ r }) {
  if (!r) return null;
  const [cls, label] = RISK[r.level] || RISK.new;
  return (
    <div className={`risk ${cls}`} title="সব দোকান মিলিয়ে এই নম্বরের অর্ডার হিস্ট্রি">
      {label} · {r.total} অর্ডার, {r.delivered} ডেলিভারড{r.bad ? `, ${r.bad} বাতিল/রিটার্ন` : ''}
    </div>
  );
}

export default function OrdersTable({ orders, compact = false, onChange }) {
  const [busy, setBusy] = useState(null);
  if (!orders.length) {
    return <div className="empty">এখনো কোনো অর্ডার নেই। কাস্টমার Messenger এ অর্ডার কনফার্ম করলে AI এখানে অর্ডার তৈরি করবে।</div>;
  }

  async function setStatus(id, status) {
    try {
      const r = await api('/orders/' + id, { method: 'PUT', body: { status } });
      toast(r.notified ? 'স্ট্যাটাস আপডেট হয়েছে — কাস্টমারকে Messenger এ জানানো হয়েছে ✓' : 'স্ট্যাটাস আপডেট হয়েছে');
      onChange?.();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function toCourier(o) {
    if (!confirm(`অর্ডার #${o.id} (${money(o.total)}) Steadfast কুরিয়ারে পাঠাবেন?`)) return;
    setBusy(o.id);
    try {
      const r = await api(`/orders/${o.id}/courier`, { method: 'POST' });
      toast(`কুরিয়ারে দেওয়া হয়েছে ✓ ট্র্যাকিং: ${r.tracking_code}${r.notified ? ' — কাস্টমারকে জানানো হয়েছে' : ''}`);
      onChange?.();
    } catch (e) {
      toast(e.message, true);
    }
    setBusy(null);
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th>{!compact && <th>Courier</th>}</tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const items = JSON.parse(o.items || '[]');
            return (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>
                  <b>{o.customer_name}</b>
                  {!compact && <div className="hint">{o.phone}<br />{o.address}</div>}
                  {!compact && <RiskBadge r={o.risk} />}
                  {!compact && o.customer_confirmed === 1 && <div className="cconf" style={{ color: '#15803d' }}>✅ কাস্টমার নিজে কনফার্ম করেছে</div>}
                  {!compact && o.customer_confirmed === -1 && <div className="cconf" style={{ color: '#b91c1c' }}>❌ কাস্টমার বাতিল করেছে</div>}
                </td>
                <td>{items.map((i) => <div key={i.product_id}>{i.name} × {i.qty}</div>)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{money(o.total)}</td>
                <td>
                  {compact ? (
                    <span className={`pill ${o.status}`}>{STATUS[o.status]}</span>
                  ) : (
                    <select defaultValue={o.status} style={{ width: 'auto' }} onChange={(e) => setStatus(o.id, e.target.value)}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{when(o.created_at)}</td>
                {!compact && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {o.tracking_code ? (
                      <a href={`https://steadfast.com.bd/t/${o.tracking_code}`} target="_blank" rel="noreferrer" className="link">🚚 {o.tracking_code}</a>
                    ) : o.status !== 'cancelled' && o.status !== 'delivered' ? (
                      <button className="btn sm" disabled={busy === o.id} onClick={() => toCourier(o)}>{busy === o.id ? 'পাঠানো হচ্ছে...' : '🚚 Steadfast'}</button>
                    ) : null}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
