'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import TestChat from '@/components/TestChat';
import TeachModal from '@/components/TeachModal';
import { PageHead } from '@/components/Shell';
import { api, toast, when } from '@/lib/client';

// One-click starting points so owners don't face an empty form
const TEMPLATES = [
  ['দোকানের ঠিকানা', 'আমাদের দোকানের ঠিকানা কোথায়?', 'আমাদের শোরুম: '],
  ['খোলার সময়', 'দোকান কখন খোলা থাকে?', 'প্রতিদিন সকাল ১০টা থেকে রাত ৯টা পর্যন্ত খোলা। শুক্রবার বন্ধ।'],
  ['ডেলিভারি সময়', 'অর্ডার করলে কত দিনে পাবো?', 'ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৪ দিনের মধ্যে ডেলিভারি দেওয়া হয়।'],
  ['রিটার্ন পলিসি', 'প্রোডাক্ট পছন্দ না হলে ফেরত দেওয়া যাবে?', 'প্রোডাক্ট হাতে পেয়ে ৩ দিনের মধ্যে কোনো সমস্যা থাকলে বদলে দেওয়া হয়। ব্যবহার করা প্রোডাক্ট ফেরত নেওয়া হয় না।'],
  ['চলমান অফার', 'এখন কোনো অফার আছে?', 'এই সপ্তাহে ১০০০ টাকার বেশি কেনাকাটায় ডেলিভারি ফ্রি!'],
  ['অরিজিনাল কিনা', 'প্রোডাক্টগুলো কি অরিজিনাল?', 'আমাদের সব প্রোডাক্ট ১০০% অরিজিনাল, সরাসরি অথরাইজড ডিস্ট্রিবিউটর থেকে আনা।'],
  ['সাইজ গাইড', 'সাইজ কীভাবে বুঝবো?', 'M = বুক ৩৮", L = বুক ৪০", XL = বুক ৪২"। মাপ দিলে আমরা সঠিক সাইজ বলে দেব।'],
  ['ক্যাশ অন ডেলিভারি', 'ক্যাশ অন ডেলিভারি আছে?', 'জি, সারা বাংলাদেশে ক্যাশ অন ডেলিভারি আছে।'],
];

const SOURCE_K = { manual: 'নিজে শেখানো', chat: 'চ্যাট থেকে', page_post: 'Facebook পোস্ট' };

function Stat({ value, label }) {
  return <div className="learn-stat"><b>{value}</b><span>{label}</span></div>;
}

export default function TrainingPage() {
  const [info, setInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [teach, setTeach] = useState(null);
  const [unanswered, setUnanswered] = useState([]);

  const loadInfo = useCallback(() => api('/learn').then(setInfo).catch(() => {}), []);
  const loadItems = useCallback(() => api('/knowledge').then(setItems), []);
  const loadUnanswered = useCallback(() => api('/unanswered').then(setUnanswered).catch(() => {}), []);
  useEffect(() => { loadInfo(); loadItems(); loadUnanswered(); }, [loadInfo, loadItems, loadUnanswered]);

  async function closeQuestion(u, status) {
    await api('/unanswered/' + u.id, { method: 'PUT', body: { status } });
    loadUnanswered();
  }

  // Poll progress while learning runs
  useEffect(() => {
    if (!info?.status.running) return;
    const t = setInterval(async () => {
      const x = await api('/learn');
      setInfo(x);
      if (!x.status.running) loadItems();
    }, 2000);
    return () => clearInterval(t);
  }, [info?.status.running, loadItems]);

  async function learnNow() {
    try {
      await api('/learn', { method: 'POST' });
      toast('শেখা শুরু হয়েছে');
      setInfo((x) => ({ ...x, status: { ...x.status, running: true, progress: 'শুরু হচ্ছে...' } }));
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function toggle(k) {
    await api('/knowledge/' + k.id, { method: 'PUT', body: { active: !k.active } });
    loadItems();
  }
  async function remove(k) {
    if (!confirm('এই তথ্যটি মুছে ফেলবেন?')) return;
    await api('/knowledge/' + k.id, { method: 'DELETE' });
    loadItems();
    loadInfo();
  }

  const c = info?.counts;
  const shown = items.filter((k) => !q || `${k.title} ${k.content}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="AI Training" sub="AI আপনার ওয়েবসাইট, Facebook পেজের পোস্ট ও ছবি থেকে নিজে শেখে — আর আপনি যা শেখাবেন তাও মনে রাখে">
        <button className="btn primary" onClick={() => setTeach({ source: 'manual' })}><Icon name="plus" /> নতুন কিছু শেখান</button>
      </PageHead>

      {info && !info.aiReady && <div className="notice">প্ল্যাটফর্মে AI এখনো চালু হয়নি — অ্যাডমিন Claude API key দিলে শেখা ও উত্তর দেওয়া শুরু হবে।</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <h3>AI যা যা জানে</h3>
            <p>
              পেজ কানেক্ট বা ওয়েবসাইট সিঙ্ক করলে নিজে থেকেই শেখে, আর নিয়মিত নতুন পোস্ট দেখে আপডেট হয়।
              {info?.status.last && ` শেষবার: ${when(info.status.last.replace('T', ' ').slice(0, 19))}`}
            </p>
          </div>
          <button className="btn orange" onClick={learnNow} disabled={info?.status.running}>
            <Icon name="refresh" /> {info?.status.running ? 'শিখছে...' : 'এখনই শেখাও'}
          </button>
        </div>
        {c && (
          <div className="learn-grid">
            <Stat value={c.products} label={`প্রোডাক্ট (ওয়েবসাইট ${c.fromWebsite} · Facebook ${c.fromFacebook})`} />
            <Stat value={`${c.imagesLearned}/${c.withImage}`} label="প্রোডাক্টের ছবি দেখে চিনেছে" />
            <Stat value={c.postsRead} label={`Facebook পোস্ট পড়েছে (${c.pages}টি পেজ)`} />
            <Stat value={c.knowledge} label="আপনার শেখানো তথ্য" />
          </div>
        )}
        {info?.status.progress && <div className="hint">{info.status.progress}</div>}
        {c && !c.pages && !c.products && (
          <div className="hint">
            শুরু করতে <Link href="/dashboard/pages">Facebook পেজ কানেক্ট করুন</Link> অথবা <Link href="/dashboard/products">ওয়েবসাইট সিঙ্ক করুন</Link>।
          </div>
        )}
      </div>

      {unanswered.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <div><h3>⚠️ AI যে প্রশ্নের উত্তর জানে না ({unanswered.length})</h3><p>কাস্টমাররা এগুলো জিজ্ঞেস করেছে কিন্তু AI উত্তর দিতে পারেনি। একবার শেখালে পরের বার নিজেই উত্তর দেবে।</p></div>
          </div>
          {unanswered.slice(0, 15).map((u) => (
            <div className="uq" key={u.id}>
              <div className="t">
                <b>{u.question}</b>
                <span>{u.reason}{u.customer_name ? ` · ${u.customer_name}` : ''}{u.times > 1 ? ` · ${u.times} বার জিজ্ঞেস করেছে` : ''} · {when(u.created_at)}</span>
              </div>
              <button className="btn sm primary" onClick={() => setTeach({ source: 'chat', title: u.question, content: '', unansweredId: u.id })}>✨ উত্তর শেখান</button>
              <button className="btn sm" onClick={() => closeQuestion(u, 'dismissed')}>বাদ দিন</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h3>এক ক্লিকে শেখান</h3><p>বাটনে চাপ দিন, নিজের মতো করে উত্তরটা বদলে নিন</p></div></div>
            <div className="templates">
              {TEMPLATES.map(([label, title, content]) => (
                <button key={label} onClick={() => setTeach({ source: 'manual', title, content })}>+ {label}</button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div><h3>শেখানো তথ্য ({items.length})</h3><p>বন্ধ করলে AI সেটা ব্যবহার করবে না</p></div>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="খুঁজুন..." style={{ width: 180 }} />
            </div>
            {!shown.length && (
              <div className="empty">
                এখনো কিছু শেখানো হয়নি।<br />উপরের বাটনগুলো দিয়ে শুরু করুন, অথবা Inbox এ কাস্টমারের মেসেজের পাশে <b>✨ উত্তর শেখান</b> চাপুন।
              </div>
            )}
            {shown.map((k) => (
              <div className="kn" key={k.id} style={{ opacity: k.active ? 1 : 0.5 }}>
                <div className="t">
                  <b>{k.title}</b>
                  <p>{k.content}</p>
                  <span className={`pill src-${k.source}-k`} style={{ marginTop: 6 }}>{SOURCE_K[k.source] || k.source}</span>
                </div>
                <div className="actions">
                  <label className="switch"><input type="checkbox" checked={!!k.active} onChange={() => toggle(k)} /><span /></label>
                  <button className="btn sm" onClick={() => setTeach(k)}>এডিট</button>
                  <button className="btn sm danger" onClick={() => remove(k)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ height: 'calc(100vh - 140px)', minHeight: 520, display: 'flex', flexDirection: 'column', position: 'sticky', top: 16 }}>
          <TestChat />
        </div>
      </div>

      {teach && (
        <TeachModal
          initial={teach}
          onClose={() => setTeach(null)}
          onSaved={async () => {
            if (teach.unansweredId) await api('/unanswered/' + teach.unansweredId, { method: 'PUT', body: { status: 'done' } });
            loadItems();
            loadInfo();
            loadUnanswered();
          }}
        />
      )}
    </>
  );
}
