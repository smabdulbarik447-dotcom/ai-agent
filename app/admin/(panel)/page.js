'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { BarChart } from '@/components/Charts';
import { api, money, when, initials, PAY_METHOD } from '@/lib/client';

function Kpi({ color, icon, label, value, children }) {
  return (
    <div className="card kpi">
      <div className={`ic ${color}`}><Icon name={icon} /></div>
      <div>
        <div className="lbl">{label}</div>
        <div className="val">{value}</div>
        <div className="sub">{children}</div>
      </div>
    </div>
  );
}

function Gauge({ value, label }) {
  const v = Math.round(Math.min(100, Math.max(0, value || 0)));
  return (
    <div className="gauge" style={{ '--v': v }}>
      <div className="dial"><b>{v}%</b></div>
      <span>{label}</span>
    </div>
  );
}

const short = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);

export default function AdminOverview() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  if (!s) return <div className="empty">লোড হচ্ছে...</div>;
  const t = s.totals;

  return (
    <>
      <section className="hud-hero">
        <div className="reactor" aria-hidden="true">
          <div className="core" />
          <i className="orbit r1"><b /></i>
          <i className="orbit r2"><b /></i>
          <i className="orbit r3"><b /></i>
        </div>
        <div className="hud-hero-text">
          <small>{'// PLATFORM STATUS · LIVE'}</small>
          <h1>স্বাগতম, কমান্ডার</h1>
          <p>সব সিস্টেম চালু — {t.users} ইউজার, {t.pages}টি পেজ/নম্বরে AI কাজ করছে। এই মাসে আয় {money(t.revenueMonth)}।</p>
          <div className="gauges">
            <Gauge value={t.users ? (t.paying / t.users) * 100 : 0} label="পেইড ইউজার" />
            <Gauge value={t.revenueMonth ? Math.max(0, 100 - ((t.aiCostUsd * t.usdToBdt) / t.revenueMonth) * 100) : 0} label="লাভের হার" />
            <Gauge value={t.users ? (t.trial / t.users) * 100 : 0} label="ট্রায়ালে" />
          </div>
        </div>
      </section>

      {t.pending > 0 && (
        <div className="notice">
          <b>{t.pending}টি পেমেন্ট</b> যাচাইয়ের অপেক্ষায় — <Link href="/admin/payments">এখনই দেখুন</Link>
        </div>
      )}

      <section className="kpis">
        <Kpi color="g" icon="users" label="Total Users" value={t.users}><b>{t.paying}</b> পেইড · <b>{t.trial}</b> ট্রায়াল</Kpi>
        <Kpi color="o" icon="card" label="এই মাসের আয়" value={money(t.revenueMonth)}>মোট <b>{money(t.revenueAll)}</b></Kpi>
        <Kpi color="p" icon="fb" label="কানেক্টেড পেজ" value={t.pages}>সব ইউজার মিলিয়ে</Kpi>
        <Kpi color="r" icon="bot" label="AI খরচ (এই মাস)" value={money(Math.round(t.aiCostUsd * t.usdToBdt))}>
          {t.aiMonth.toLocaleString('en-IN')} রিপ্লাই · লাভ <b>{money(Math.round(t.revenueMonth - t.aiCostUsd * t.usdToBdt))}</b>
        </Kpi>
      </section>

      <section className="grid-2-eq" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>আয়</h3><p>গত ১৪ দিনে অনুমোদিত পেমেন্ট</p></div>
            <div className="legend"><span><i style={{ background: '#22d3ee' }} />Revenue</span></div>
          </div>
          <BarChart days={s.days} series={[{ key: 'revenue', label: 'আয় ৳', color: '#22d3ee' }]} format={short} />
        </div>
        <div className="card">
          <div className="card-head">
            <div><h3>নতুন ইউজার</h3><p>গত ১৪ দিনে সাইন আপ</p></div>
            <div className="legend"><span><i style={{ background: '#c084fc' }} />Signups</span></div>
          </div>
          <BarChart days={s.days} series={[{ key: 'signups', label: 'সাইন আপ', color: '#c084fc' }]} />
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-head">
            <div><h3>পেন্ডিং পেমেন্ট</h3><p>যাচাই করে অনুমোদন দিন</p></div>
            <Link className="link" href="/admin/payments">View All ↗</Link>
          </div>
          {!s.pendingPayments.length ? (
            <div className="empty">কোনো পেন্ডিং পেমেন্ট নেই ✓</div>
          ) : (
            <div className="list">
              {s.pendingPayments.map((p) => (
                <Link className="li" href="/admin/payments" key={p.id}>
                  <div className="t"><b>{p.user_name} — {p.plan_name}</b><span>{PAY_METHOD[p.method]} · {p.sender} · {p.trx_id}</span></div>
                  <div className="time"><b>{money(p.amount)}</b><br />{when(p.created_at)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><div><h3>প্ল্যান অনুযায়ী ইউজার</h3><p>এখন চালু সাবস্ক্রিপশন</p></div></div>
          <div className="list">
            {s.plans.map((p) => (
              <div className="li" key={p.name}>
                <div className="t"><b>{p.name}</b></div>
                <b>{p.c}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div><h3>নতুন ইউজার</h3></div>
            <Link className="link" href="/admin/users">View All ↗</Link>
          </div>
          <div className="list">
            {!s.recentUsers.length && <div className="empty">এখনো কেউ সাইন আপ করেনি</div>}
            {s.recentUsers.map((u) => (
              <div className="li" key={u.id}>
                <div className="avatar">{initials(u.name)}</div>
                <div className="t"><b>{u.name}</b><span>{u.email}</span></div>
                <div className="time">{when(u.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
