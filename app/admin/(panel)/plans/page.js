'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import PlanCard from '@/components/PlanCard';
import { PageHead } from '@/components/Shell';
import { api, toast } from '@/lib/client';

function PlanForm({ p = {} }) {
  const num = (name, label, hint) => (
    <div className="field">
      <label>{label}</label>
      <input type="number" name={name} defaultValue={p[name] ?? 0} min={0} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
  const sw = (name, label) => (
    <div className="switch-row">
      <label className="switch"><input type="checkbox" name={name} defaultChecked={p.id ? !!p[name] : true} /><span /></label> {label}
    </div>
  );
  return (
    <>
      <div className="form-grid">
        <div className="field"><label>নাম</label><input type="text" name="name" defaultValue={p.name} required /></div>
        <div className="field"><label>Slug (ইংরেজি, ইউনিক)</label><input type="text" name="slug" defaultValue={p.slug} placeholder="business" /></div>
        {num('price', 'দাম (৳)')}
        {num('period_days', 'মেয়াদ (দিন)')}
        {num('max_pages', 'Facebook পেজ', '0 = আনলিমিটেড')}
        {num('ai_replies', 'মাসে AI রিপ্লাই', '0 = আনলিমিটেড')}
        {num('max_products', 'প্রোডাক্ট', '0 = আনলিমিটেড')}
        {num('max_rules', 'অটো রিপ্লাই রুল', '0 = আনলিমিটেড')}
        {num('sort', 'ক্রম (ছোট = আগে)')}
      </div>
      {sw('website_sync', 'ওয়েবসাইট থেকে প্রোডাক্ট সিঙ্ক')}
      {sw('ai_orders', 'AI নিজে অর্ডার নেবে')}
      {sw('active', 'বিক্রির জন্য দেখাবে')}
      <div className="field">
        <label>অতিরিক্ত ফিচার (প্রতি লাইনে একটি)</label>
        <textarea name="features" rows={3} defaultValue={p.features} />
      </div>
    </>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api('/admin/plans').then(setPlans);
  useEffect(() => { load(); }, []);

  async function save(d) {
    if (editing.id) await api('/admin/plans/' + editing.id, { method: 'PUT', body: d });
    else await api('/admin/plans', { method: 'POST', body: d });
    toast('সেভ হয়েছে ✓');
    load();
  }

  async function remove(p) {
    if (!confirm(`"${p.name}" প্ল্যান মুছবেন?`)) return;
    const r = await api('/admin/plans/' + p.id, { method: 'DELETE' });
    toast(r.hidden ? 'এই প্ল্যান আগে বিক্রি হয়েছে, তাই লুকিয়ে রাখা হলো' : 'ডিলিট হয়েছে');
    load();
  }

  return (
    <>
      <PageHead title="Plans" sub="দাম, লিমিট ও ফিচার ঠিক করুন — ল্যান্ডিং পেজ ও Billing পেজে সাথে সাথে আপডেট হবে">
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" /> নতুন প্ল্যান</button>
      </PageHead>
      <div className="plans">
        {plans.map((p) => (
          <div key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
            <PlanCard plan={p} ribbon={p.active ? null : 'লুকানো'}>
              <div className="row">
                <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditing(p)}>এডিট</button>
                <button className="btn danger" onClick={() => remove(p)}>মুছুন</button>
              </div>
            </PlanCard>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? `${editing.name} এডিট` : 'নতুন প্ল্যান'} onSubmit={save} onClose={() => setEditing(null)}>
          <PlanForm p={editing} />
        </Modal>
      )}
    </>
  );
}
