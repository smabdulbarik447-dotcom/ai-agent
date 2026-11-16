'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, toast } from '@/lib/client';

function SignupForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/signup', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      const plan = params.get('plan');
      window.location.href = plan ? `/dashboard/billing?plan=${encodeURIComponent(plan)}` : '/dashboard';
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
          <h2>নতুন অ্যাকাউন্ট</h2>
          <p>কয়েক সেকেন্ডেই আপনার AI এজেন্ট তৈরি করুন</p>
        </div>
        <div className="field"><label>আপনার নাম</label><input type="text" name="name" required autoFocus /></div>
        <div className="field"><label>ব্যবসা / পেজের নাম</label><input type="text" name="business_name" required placeholder="যেমন: Rahim Fashion" /></div>
        <div className="field"><label>মোবাইল নম্বর</label><input type="text" name="phone" placeholder="01XXXXXXXXX" /></div>
        <div className="field"><label>ইমেইল</label><input type="text" name="email" autoComplete="email" required /></div>
        <div className="field"><label>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label><input type="password" name="password" autoComplete="new-password" minLength={6} required /></div>
        <button className="btn primary block" disabled={busy}>{busy ? 'অপেক্ষা করুন...' : 'অ্যাকাউন্ট খুলুন'}</button>
        <div className="alt">
          অ্যাকাউন্ট খুললে আপনি আমাদের <Link href="/terms">Terms</Link> ও <Link href="/privacy">Privacy Policy</Link> মেনে নিচ্ছেন।
        </div>
        <div className="alt">আগেই অ্যাকাউন্ট আছে? <Link href="/login">লগইন করুন</Link></div>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
