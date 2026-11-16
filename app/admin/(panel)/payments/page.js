'use client';

import { useEffect, useState } from 'react';
import { PageHead, useMe } from '@/components/Shell';
import { api, toast, money, when, PAY_METHOD, PAY_STATUS } from '@/lib/client';

export default function PaymentsPage() {
  const { reload } = useMe();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);

  const load = () => api('/admin/payments?status=' + status).then(setList);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  async function review(p, action) {
    let note = '';
    if (action === 'reject') {
      note = prompt('বাতিলের কারণ (ইউজার দেখতে পাবে):', 'TrxID মিলেনি');
      if (note === null) return;
    } else if (!confirm(`${p.user_name} এর ${money(p.amount)} (${PAY_METHOD[p.method]}, ${p.trx_id}) পেমেন্ট অনুমোদন করবেন? ${p.plan_name} প্ল্যান চালু হবে।`)) {
      return;
    }
    try {
      await api('/admin/payments/' + p.id, { method: 'PUT', body: { action, note } });
      toast(action === 'approve' ? 'অনুমোদিত — প্ল্যান চালু হয়েছে ✓' : 'বাতিল করা হয়েছে');
      load();
      reload();
    } catch (e) {
      toast(e.message, true);
    }
  }

  return (
    <>
      <PageHead title="Payments" sub="বিকাশ/নগদ/রকেট অ্যাপে TrxID মিলিয়ে অনুমোদন দিন">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="pending">যাচাই বাকি</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">বাতিল</option>
          <option value="">সব</option>
        </select>
      </PageHead>
      <div className="card">
        {list && !list.length && <div className="empty">কোনো পেমেন্ট নেই</div>}
        {list?.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>User</th><th>প্ল্যান</th><th>টাকা</th><th>মেথড</th><th>প্রেরক নম্বর</th><th>TrxID</th><th>সময়</th><th>স্ট্যাটাস</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td><b>{p.user_name}</b><div className="hint">{p.email}{p.user_phone ? ` · ${p.user_phone}` : ''}</div></td>
                    <td>{p.plan_name}</td>
                    <td><b>{money(p.amount)}</b></td>
                    <td>{PAY_METHOD[p.method]}</td>
                    <td>{p.sender}</td>
                    <td><code>{p.trx_id}</code></td>
                    <td className="hint" style={{ whiteSpace: 'nowrap' }}>{when(p.created_at)}</td>
                    <td><span className={`pill ${p.status}`}>{PAY_STATUS[p.status]}</span>{p.note && <div className="hint">{p.note}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {p.status === 'pending' && (
                        <>
                          <button className="btn sm primary" onClick={() => review(p, 'approve')}>অনুমোদন</button>{' '}
                          <button className="btn sm danger" onClick={() => review(p, 'reject')}>বাতিল</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
