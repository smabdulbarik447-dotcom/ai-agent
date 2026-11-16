'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import { api, daysLeft } from '@/lib/client';

const NAV = {
  user: [
    ['/dashboard', 'Overview', 'grid'],
    ['/dashboard/agent', 'AI Agent', 'bot', 'live'],
    ['/dashboard/rules', 'Auto Reply', 'zap'],
    ['/dashboard/products', 'Products', 'box'],
    ['/dashboard/customers', 'Customers', 'users'],
    ['/dashboard/orders', 'Orders', 'clip', 'orders'],
    ['/dashboard/inbox', 'Inbox', 'inbox', 'unread'],
    ['/dashboard/pages', 'Facebook Pages', 'fb'],
    ['/dashboard/billing', 'Billing', 'card'],
    ['/dashboard/settings', 'Settings', 'cog'],
  ],
  admin: [
    ['/admin', 'Overview', 'grid'],
    ['/admin/users', 'Users', 'users'],
    ['/admin/payments', 'Payments', 'card', 'payments'],
    ['/admin/plans', 'Plans', 'layers'],
    ['/admin/settings', 'Platform Settings', 'cog'],
  ],
};

const ShellContext = createContext({ toggle: () => {}, me: null, reload: () => {} });
export const useMe = () => useContext(ShellContext);

export function PageHead({ title, sub, children }) {
  const { toggle } = useContext(ShellContext);
  return (
    <div className="page-head">
      <div className="row">
        <button className="btn menu-btn" onClick={toggle} aria-label="Menu"><Icon name="menu" /></button>
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

function PlanCard({ sub }) {
  if (!sub) {
    return (
      <div className="side-card warn">
        <h4>কোনো প্ল্যান নেই</h4>
        <p>বট চালু করতে একটি প্ল্যান কিনুন</p>
        <Link className="btn orange block" href="/dashboard/billing">প্ল্যান কিনুন</Link>
      </div>
    );
  }
  const left = daysLeft(sub.ends_at);
  return (
    <div className="side-card">
      <div className="bot"><Icon name="bot" /></div>
      <h4>{sub.plan_name} {sub.status === 'trial' && <span className="badge live">Trial</span>}</h4>
      <p>{left > 0 ? `আর ${left} দিন বাকি` : 'আজ শেষ হবে'}</p>
      <Link className={`btn ${left <= 3 ? 'orange' : 'primary'} block`} href="/dashboard/billing">
        {left <= 3 ? 'রিনিউ করুন' : 'প্ল্যান দেখুন'} <Icon name="arrow" />
      </Link>
    </div>
  );
}

export default function Shell({ variant = 'user', children }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(null);

  const reload = useCallback(() => api('/me').then(setMe).catch(() => {}), []);

  useEffect(() => {
    setOpen(false);
    reload();
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [path, reload]);

  useEffect(() => {
    if (variant === 'admin' && me && me.user.role !== 'admin') router.replace('/admin/login');
  }, [variant, me, router]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = variant === 'admin' ? '/admin/login' : '/login';
  }

  const root = variant === 'admin' ? '/admin' : '/dashboard';
  const active = (href) => (href === root ? path === root : path.startsWith(href));
  const logo = variant === 'admin' ? '/logo.svg' : me?.shop.logo || '/logo.svg';
  const badges = me?.badges || {};

  if (variant === 'admin' && me?.user.role !== 'admin') return null;

  return (
    <ShellContext.Provider value={{ toggle: () => setOpen((o) => !o), me, reload }}>
      <div className="app">
        <div className={'overlay' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
        <aside className={'sidebar' + (open ? ' open' : '')}>
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="logo" />
            {variant === 'admin' && <span className="badge admin-tag">Super Admin</span>}
          </div>
          <nav className="nav">
            {NAV[variant].map(([href, label, icon, badge]) => (
              <Link key={href} href={href} className={active(href) ? 'active' : ''}>
                <Icon name={icon} />
                {label}
                {badge === 'live' && <span className="badge live">Live</span>}
                {badge && badge !== 'live' && badges[badge] > 0 && <span className="badge">{badges[badge]}</span>}
              </Link>
            ))}
          </nav>
          {variant === 'user' ? (
            me && <PlanCard sub={me.subscription} />
          ) : (
            <div className="side-card">
              <p style={{ margin: '0 0 10px' }}>নিজের শপের বট চালাতে</p>
              <Link className="btn block" href="/dashboard">শপ ড্যাশবোর্ড</Link>
            </div>
          )}
          <div className="side-foot">
            <span title={me?.user.email}>{me?.user.name || ''}</span>
            <span className="row" style={{ gap: 12 }}>
              {variant === 'user' && me?.user.role === 'admin' && <Link href="/admin" className="link">Admin</Link>}
              <button onClick={logout}>Logout</button>
            </span>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </ShellContext.Provider>
  );
}
