'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { PageHead, useMe } from '@/components/Shell';
import { api, toast, dateOnly, daysLeft, initials, when } from '@/lib/client';

export default function UsersPage() {
  const { me } = useMe();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [rate, setRate] = useState(122);
  const [granting, setGranting] = useState(null);

  const load = useCallback(() => api('/admin/users?q=' + encodeURIComponent(q)).then(setUsers), [q]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    api('/admin/plans').then(setPlans);
    api('/admin/settings').then((x) => setRate(Number(x.usd_to_bdt) || 122));
  }, []);

  // Open this user's dashboard as them (to help with support); "অ্যাডমিনে ফিরুন" brings you back
  async function loginAs(u) {
    if (!confirm(`${u.name} (${u.email}) এর ড্যাশবোর্ড তার মতো করে দেখবেন?`)) return;
    try {
      await api(`/admin/users/${u.id}/login-as`, { method: 'POST' });
      window.location.href = '/dashboard';
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function update(u, body, msg) {
    try {
      await api('/admin/users/' + u.id, { method: 'PUT', body });
      toast(msg);
      load();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function remove(u) {
    if (!confirm(`${u.email} অ্যাকাউন্ট ও তার সব ডাটা (পেজ, প্রোডাক্ট, চ্যাট) চিরতরে ডিলিট করবেন?`)) return;
    try {
      await api('/admin/users/' + u.id, { method: 'DELETE' });
      toast('ডিলিট হয়েছে');
      load();
    } catch (e) {
      toast(e.message, true);
    }
  }

  return (
    <>
      <PageHead title="Users" sub={`মোট ${users.length} জন`}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম, ইমেইল বা ফোন..." style={{ width: 260 }} />
      </PageHead>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>প্ল্যান</th><th>মেয়াদ</th><th>পেজ</th><th>প্রোডাক্ট</th><th>AI (মাস)</th><th>AI খরচ</th><th>স্ট্যাটাস</th><th>শেষ লগইন</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="prod">
                      <div className="avatar">{initials(u.name)}</div>
                      <div>
                        <div className="n">{u.name} {u.role === 'admin' && <span className="badge admin-tag">Admin</span>}</div>
                        <div className="s">{u.business_name ? `${u.business_name} · ` : ''}{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.plan_name ? <span className={`pill ${u.sub_status}`}>{u.plan_name}{u.sub_status === 'trial' ? ' (Trial)' : ''}</span> : <span className="hint">নেই</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{u.ends_at ? <>{dateOnly(u.ends_at)}<div className="hint">{daysLeft(u.ends_at)} দিন বাকি</div></> : '—'}</td>
                  <td>{u.pages}</td>
                  <td>{u.products}</td>
                  <td>{u.ai_month}</td>
                  <td style={{ whiteSpace: 'nowrap' }} title={'$' + Number(u.ai_cost_usd || 0).toFixed(3)}>৳{Math.round((u.ai_cost_usd || 0) * rate)}</td>
                  <td><span className={`pill ${u.status}`}>{u.status === 'active' ? 'চালু' : 'সাসপেন্ড'}</span></td>
                  <td className="hint" style={{ whiteSpace: 'nowrap' }}>{when(u.last_login_at) || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {u.role !== 'admin' && <><button className="btn sm" onClick={() => loginAs(u)}>👁 দেখুন</button>{' '}</>}
                    <button className="btn sm" onClick={() => setGranting(u)}>প্ল্যান দিন</button>{' '}
                    {u.plan_name && <><button className="btn sm" onClick={() => confirm('এই ইউজারের প্ল্যান বন্ধ করবেন?') && update(u, { endPlan: true }, 'প্ল্যান বন্ধ হয়েছে')}>প্ল্যান বন্ধ</button>{' '}</>}
                    {u.id !== me?.user.id && (
                      <>
                        <button className="btn sm" onClick={() => update(u, { status: u.status === 'active' ? 'suspended' : 'active' }, 'আপডেট হয়েছে')}>
                          {u.status === 'active' ? 'সাসপেন্ড' : 'চালু করুন'}
                        </button>{' '}
                        <button className="btn sm danger" onClick={() => remove(u)}>✕</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <div className="empty">কোনো ইউজার পাওয়া যায়নি</div>}
      </div>

      {granting && (
        <Modal
          title={`${granting.name} কে প্ল্যান দিন`}
          submitLabel="প্ল্যান চালু করুন"
          onClose={() => setGranting(null)}
          onSubmit={async (d) => {
            await api('/admin/users/' + granting.id, { method: 'PUT', body: { grant: { plan_id: Number(d.plan_id), days: Number(d.days) } } });
            toast('প্ল্যান চালু হয়েছে ✓');
            load();
          }}
        >
          <p className="hint" style={{ marginTop: -8 }}>পেমেন্ট ছাড়াই হাতে প্ল্যান দিতে (যেমন ক্যাশ পেমেন্ট বা ফ্রি গিফট)। একই প্ল্যান চালু থাকলে মেয়াদ বাড়বে।</p>
          <div className="form-grid">
            <div className="field">
              <label>প্ল্যান</label>
              <select name="plan_id" defaultValue={granting.plan_id || plans[0]?.id}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ৳{p.price}</option>)}
              </select>
            </div>
            <div className="field"><label>কত দিন</label><input type="number" name="days" defaultValue={30} min={1} required /></div>
          </div>
        </Modal>
      )}
    </>
  );
}
