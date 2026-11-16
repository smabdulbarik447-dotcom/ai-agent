'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { PageHead, useMe } from '@/components/Shell';
import { BarChart, Donut } from '@/components/Charts';
import TestChat from '@/components/TestChat';
import OrdersTable from '@/components/OrdersTable';
import { api, money, initials, when, limitText, STOCK } from '@/lib/client';

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

function ConvItem({ c }) {
  return (
    <Link className="li" href={`/dashboard/inbox?c=${c.id}`}>
      <div className="avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.profile_pic ? <img src={c.profile_pic} alt="" /> : initials(c.name)}
      </div>
      <div className="t"><b>{c.name || 'Facebook User'}</b><span>{c.last_text}</span></div>
      <div className="time">
        {when(c.last_message_at)}<br />
        {c.unread > 0 && <span className="badge">{c.unread}</span>}
      </div>
    </Link>
  );
}

function Setup({ setup }) {
  const steps = [
    [setup.plan, 'প্ল্যান চালু করুন', '/dashboard/billing'],
    [setup.page, 'Facebook পেজ কানেক্ট করুন', '/dashboard/pages'],
    [setup.products, 'ওয়েবসাইট থেকে প্রোডাক্ট সিঙ্ক করুন', '/dashboard/products'],
  ];
  if (steps.every(([done]) => done)) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><div><h3>সেটআপ সম্পন্ন করুন</h3><p>এই ধাপগুলো শেষ করলেই আপনার বট কাস্টমারদের উত্তর দেওয়া শুরু করবে</p></div></div>
      <div className="list">
        {steps.map(([done, label, href]) => (
          <Link key={href} href={href} className="li">
            <span className={`pill ${done ? 'on' : 'pending'}`}>{done ? '✓ সম্পন্ন' : 'বাকি'}</span>
            <div className="t"><b>{label}</b></div>
            {!done && <span className="link">শুরু করুন ↗</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Overview() {
  const { me } = useMe();
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/stats').then(setS).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="notice">{err}</div>;
  if (!s) return <div className="empty">লোড হচ্ছে...</div>;

  const t = s.totals;
  const sub = me?.subscription;
  const [first, ...rest] = (s.business.name || 'আপনার শপ').split(' ');

  return (
    <>
      <PageHead title="Overview" />
      <Setup setup={s.setup} />

      <section className="hero">
        <div>
          <h2>আপনার ব্যবসাকে আরও স্মার্ট করুন</h2>
          <h1>{first} <b>{rest.join(' ')}</b> AI-এর সাথে</h1>
          <p>AI আপনার কাস্টমারের সাথে কথা বলবে, অর্ডার নেবে, এবং আপনার সেল বাড়াবে — ২৪/৭।</p>
        </div>
        <div className="hero-right">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="logo-box"><img src={s.business.logo} alt="" /></div>
          {s.business.tagline && <div className="tag">{s.business.tagline.replace(', ', ',\n')}</div>}
        </div>
      </section>

      <section className="kpis">
        <Kpi color="g" icon="cart" label="Total Orders" value={t.orders}><b>{t.newOrders}</b> নতুন অর্ডার</Kpi>
        <Kpi color="o" icon="users" label="Total Customers" value={t.conversations}>আজ <b>{t.messagesToday}</b>টি মেসেজ</Kpi>
        <Kpi color="p" icon="box" label="Total Products" value={t.products}><b>{t.inStock}</b>টি স্টকে আছে</Kpi>
        <Kpi color="r" icon="pulse" label="AI Replies (এই মাস)" value={s.aiUsed}>
          {sub ? <>লিমিট <b>{limitText(sub.ai_replies)}</b></> : 'কোনো প্ল্যান নেই'}
        </Kpi>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-head">
            <div><h3>Message Overview</h3><p>গত ১৪ দিনের মেসেজ ও অটো রিপ্লাই</p></div>
            <div className="legend">
              <span><i style={{ background: '#16a34a' }} />Messages</span>
              <span><i style={{ background: '#f97316' }} />Auto replies</span>
            </div>
          </div>
          <BarChart days={s.days} />
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Reply Source</h3><p>গত ৩০ দিনে কে উত্তর দিয়েছে · সেল {money(t.sales)}</p></div></div>
          <Donut sources={s.sources} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <TestChat maxHeight={300} />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-head">
            <div><h3>Recent Orders</h3><p>AI এজেন্টের নেওয়া সর্বশেষ অর্ডার</p></div>
            <Link className="link" href="/dashboard/orders">View All ↗</Link>
          </div>
          <OrdersTable orders={s.recentOrders} compact />
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div><h3>Recent Conversations</h3><p>সর্বশেষ কাস্টমার চ্যাট</p></div>
              <Link className="link" href="/dashboard/inbox">View All ↗</Link>
            </div>
            <div className="list">
              {s.recentConversations.length ? s.recentConversations.map((c) => <ConvItem key={c.id} c={c} />) : <div className="empty">এখনো কোনো চ্যাট নেই</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <div><h3>Stock Alert</h3><p>স্টক শেষ বা কম</p></div>
              <Link className="link" href="/dashboard/products">View All ↗</Link>
            </div>
            <div className="list">
              {s.attention.length ? (
                s.attention.map((p) => (
                  <div className="li" key={p.id}>
                    <div className="t"><b>{p.name}</b><span>{money(p.price)}</span></div>
                    <span className={`pill ${p.stock_status}`}>{p.stock_qty != null ? `${p.stock_qty}টি` : STOCK[p.stock_status]}</span>
                  </div>
                ))
              ) : (
                <div className="empty">সব ঠিক আছে ✓</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
