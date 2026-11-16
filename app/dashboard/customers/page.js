'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/Shell';
import { api, initials, when } from '@/lib/client';

export default function CustomersPage() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/conversations').then(setList); }, []);

  return (
    <>
      <PageHead title="Customers" sub="Messenger এ যারা মেসেজ দিয়েছে" />
      <div className="card">
        {list && !list.length && <div className="empty">এখনো কোনো কাস্টমার নেই। Facebook পেজ কানেক্ট করলে এখানে দেখাবে।</div>}
        {list?.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Customer</th><th>Page</th><th>Phone</th><th>Address</th><th>Messages</th><th>Orders</th><th>Bot</th><th>Last active</th><th /></tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="prod">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <div className="avatar">{c.profile_pic ? <img src={c.profile_pic} alt="" /> : initials(c.name)}</div>
                        <b>{c.name || 'Facebook User'}</b>
                      </div>
                    </td>
                    <td className="hint">{c.page_name || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td className="hint" style={{ maxWidth: 260 }}>{c.address || '—'}</td>
                    <td>{c.message_count}</td>
                    <td>{c.order_count}</td>
                    <td><span className={`pill ${c.bot_paused ? 'off' : 'on'}`}>{c.bot_paused ? 'বন্ধ' : 'চালু'}</span></td>
                    <td className="hint" style={{ whiteSpace: 'nowrap' }}>{when(c.last_message_at)}</td>
                    <td><Link className="btn sm" href={`/dashboard/inbox?c=${c.id}`}>চ্যাট</Link></td>
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
