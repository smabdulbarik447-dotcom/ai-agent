'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, toast } from '@/lib/client';

function LoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), as: 'user' } });
      const next = params.get('next');
      window.location.href = next?.startsWith('/dashboard') ? next : '/dashboard';
    } catch (err) {
      toast(err.message, true);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <div className="head">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" />
          </Link>
          <h2>লগইন করুন</h2>
          <p>আপনার অ্যাকাউন্টে প্রবেশ করুন</p>
        </div>
        <div className="field"><label>ইমেইল</label><input type="text" name="email" autoComplete="email" required autoFocus /></div>
        <div className="field"><label>পাসওয়ার্ড</label><input type="password" name="password" autoComplete="current-password" required /></div>
        <button className="btn primary block" disabled={busy}>{busy ? 'অপেক্ষা করুন...' : 'লগইন'}</button>
        <div className="alt">অ্যাকাউন্ট নেই? <Link href="/signup">নতুন অ্যাকাউন্ট খুলুন</Link></div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
