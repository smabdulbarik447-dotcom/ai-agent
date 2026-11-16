'use client';

import { api, money, toast, when, STATUS } from '@/lib/client';

export default function OrdersTable({ orders, compact = false }) {
  if (!orders.length) {
    return <div className="empty">এখনো কোনো অর্ডার নেই। কাস্টমার Messenger এ অর্ডার কনফার্ম করলে AI এখানে অর্ডার তৈরি করবে।</div>;
  }
  async function setStatus(id, status) {
    try {
      await api('/orders/' + id, { method: 'PUT', body: { status } });
      toast('স্ট্যাটাস আপডেট হয়েছে');
    } catch (e) {
      toast(e.message, true);
    }
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
