'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, toast } from '@/lib/client';

function AdminLoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), as: 'admin' } });
      const next = params.get('next');
      window.location.href = next?.startsWith('/admin') ? next : '/admin';
    } catch (err) {
      toast(err.message, true);
      setBusy(false);
    }
  }

  return (
    <div className="hud-login">
      <div className="hud-bg" aria-hidden="true">
        <div className="hud-stars" />
        <div className="hud-floor" />
        <div className="hud-scan" />
      </div>
      <form className="vault" onSubmit={submit}>
        <div className="vault-rings" aria-hidden="true">
          <i className="vr1" /><i className="vr2" /><i className="vr3" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
          <span className="vault-sweep" />
        </div>
        <small className="vault-tag">{'// RESTRICTED ACCESS · LEVEL 5'}</small>
        <h2>COMMAND DECK</h2>
        <p>শুধু প্ল্যাটফর্ম অ্যাডমিনের জন্য</p>
        <label htmlFor="admin-pass">ACCESS CODE</label>
        <input id="admin-pass" type="password" name="password" autoComplete="current-password" required autoFocus placeholder="••••••••" />
        <button className="vault-btn" disabled={busy}>{busy ? 'যাচাই হচ্ছে...' : 'প্রবেশ করুন  →'}</button>
        <div className="vault-foot"><span><i /> SECURE CHANNEL</span><span>HTTPS · TLS</span></div>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return <Suspense><AdminLoginForm /></Suspense>;
}
