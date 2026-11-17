import Link from 'next/link';
import Icon from '@/components/Icon';
import PlanCard from '@/components/PlanCard';
import { LegalFooter } from '@/components/LegalLayout';
import { getPlatform } from '@/lib/db';
import { getPlans } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const FEATURES = [
  ['g', 'bot', 'AI সেলস এজেন্ট', 'কাস্টমারের প্রশ্ন বুঝে বাংলা, Banglish বা English এ উত্তর দেয় — দাম, স্টক, ডেলিভারি সব।'],
  ['o', 'zap', 'নিজের অটো রিপ্লাই', 'কোন মেসেজে কী উত্তর যাবে আগে থেকে ঠিক করে দিন। কীওয়ার্ড মিললেই সাথে সাথে রিপ্লাই।'],
  ['p', 'box', 'ওয়েবসাইট থেকে প্রোডাক্ট', 'আপনার ওয়েবসাইটের লিংক দিন — সব প্রোডাক্ট, দাম, স্টক নিজে থেকেই পড়ে নেবে।'],
  ['r', 'cart', 'অর্ডার নেবে AI', 'নাম, ফোন, ঠিকানা নিয়ে মোট দাম হিসাব করে অর্ডার তৈরি করে দেবে।'],
  ['g', 'inbox', 'এক জায়গায় ইনবক্স', 'সব কথোপকথন দেখুন, দরকার হলে নিজে উত্তর দিন — বট নিজে সরে যাবে।'],
  ['o', 'pulse', 'রিপোর্ট ও অ্যানালিটিক্স', 'কতজন মেসেজ দিল, কতগুলো অটো রিপ্লাই গেল, কত সেল হলো — সব ড্যাশবোর্ডে।'],
];

export default async function Landing() {
  const p = (await getPlatform());
  const plans = (await getPlans());
  const featured = plans.length > 1 ? plans[Math.floor(plans.length / 2)].id : null;
  const [first, ...rest] = (p.brand_name || 'Shob Paabo AI').split(' ');

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" /> {p.brand_name}
        </Link>
        <nav className="row">
          <a href="#features" className="link hide-sm">ফিচার</a>
          <a href="#pricing" className="link hide-sm">প্রাইসিং</a>
          <Link href="/login" className="btn">লগইন</Link>
          <Link href="/signup" className="btn primary">ফ্রি শুরু করুন</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div>
          <h1>
            আপনার Facebook পেজের জন্য <em>২৪/৭ AI</em> সেলস এজেন্ট — <b>{first} {rest.join(' ')}</b>
          </h1>
          <p>
            কাস্টমার মেসেজ দিলেই সাথে সাথে উত্তর। প্রোডাক্টের দাম, স্টক, ডেলিভারি চার্জ বলে দেবে, অর্ডারও নিয়ে নেবে। আপনি ঘুমালেও সেল চলবে।
          </p>
          <div className="row">
            <Link href="/signup" className="btn primary">
              {Number(p.trial_days) > 0 ? `${p.trial_days} দিন ফ্রি ট্রায়াল` : 'অ্যাকাউন্ট খুলুন'} <Icon name="arrow" />
            </Link>
            <a href="#pricing" className="btn">প্ল্যান দেখুন</a>
          </div>
        </div>
        <div className="stage3d">
          <div className="phone-shadow" />
          <div className="float-chip fc1">✅ অর্ডার কনফার্ম</div>
          <div className="float-chip fc2">⚡ ১ সেকেন্ডে রিপ্লাই</div>
          <div className="float-chip fc3">💬 WhatsApp + Messenger</div>
        <div className="lp-demo">
          <div className="chat-head">
            <div className="avatar"><Icon name="bot" /></div>
            <div><b>AI Agent</b><small><span className="dot" /> Online</small></div>
          </div>
          <div className="msgs" style={{ minHeight: 0 }}>
            <div className="msg-wrap in"><div className="msg in">vai, vitamin c serum er dam koto?</div></div>
            <div className="msg-wrap out"><div className="msg out">জি ভাইয়া, Vitamin C Serum এর দাম ৳৬৫০, স্টকে আছে ✅ ঢাকার ভিতরে ডেলিভারি চার্জ ৳৬০। অর্ডার করতে চাইলে নাম, ফোন নম্বর আর ঠিকানা দিন 😊</div></div>
            <div className="msg-wrap in"><div className="msg in">2ta nibo, Rahim, 01712345678, Mirpur 10</div></div>
            <div className="msg-wrap out"><div className="msg out">ধন্যবাদ রহিম ভাই! ২টি Vitamin C Serum — মোট ৳১,৩৬০ (ডেলিভারিসহ)। আপনার অর্ডার #১২৫৪ কনফার্ম হয়েছে 🎉</div></div>
          </div>
        </div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <h2>যা যা পাবেন</h2>
        <p>সেটআপ ৫ মিনিটে — কোনো কোডিং লাগবে না</p>
        <div className="features">
          {FEATURES.map(([c, ic, t, d]) => (
            <div className="feature" key={t}>
              <div className={`ic ${c}`}><Icon name={ic} /></div>
              <h4>{t}</h4>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section bg-soft">
        <h2>কীভাবে শুরু করবেন</h2>
        <p>মাত্র ৩টি ধাপ</p>
        <div className="steps-row">
          <div><h4>অ্যাকাউন্ট খুলুন</h4><p className="hint">ইমেইল দিয়ে সাইন আপ করে প্ল্যান বেছে নিন</p></div>
          <div><h4>পেজ কানেক্ট করুন</h4><p className="hint">এক ক্লিকে আপনার Facebook পেজ যুক্ত করুন</p></div>
          <div><h4>প্রোডাক্ট দিন</h4><p className="hint">ওয়েবসাইটের লিংক দিন — বাকিটা বট সামলাবে</p></div>
        </div>
      </section>

      <section className="lp-section" id="pricing">
        <h2>প্রাইসিং</h2>
        <p>{Number(p.trial_days) > 0 ? `সব প্ল্যানেই প্রথমে ${p.trial_days} দিন ফ্রি ট্রায়াল। ` : ''}বিকাশ / নগদ / রকেটে পেমেন্ট।</p>
        <div className="plans" style={{ maxWidth: 1100, margin: '0 auto' }}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} featured={plan.id === featured} ribbon={plan.id === featured ? 'সবচেয়ে জনপ্রিয়' : null}>
              <Link href={`/signup?plan=${plan.slug}`} className={`btn ${plan.id === featured ? 'orange' : 'primary'} block`}>শুরু করুন</Link>
            </PlanCard>
          ))}
        </div>
      </section>

      <LegalFooter name={p.brand_name} />
    </div>
  );
}
