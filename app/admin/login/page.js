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
    <div className="auth admin-auth">
      <form className="card" onSubmit={submit}>
        <div className="head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
          <h2>Admin Panel</h2>
          <p>শুধু প্ল্যাটফর্ম অ্যাডমিনের জন্য</p>
        </div>
        <div className="field"><label>অ্যাডমিন পাসওয়ার্ড</label><input type="password" name="password" autoComplete="current-password" required autoFocus /></div>
        <button className="btn primary block" disabled={busy}>{busy ? 'অপেক্ষা করুন...' : 'অ্যাডমিন লগইন'}</button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return <Suspense><AdminLoginForm /></Suspense>;
}
