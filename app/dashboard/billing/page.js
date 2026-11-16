'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PlanCard from '@/components/PlanCard';
import { PageHead, useMe } from '@/components/Shell';
import { api, toast, money, dateOnly, daysLeft, limitText, PAY_METHOD, PAY_STATUS } from '@/lib/client';

function Usage({ label, used, max }) {
  const unlimited = !max || max <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="usage">
      <div className="top"><span>{label}</span><b>{used} / {limitText(max)}</b></div>
      <div className="bar-track"><div className={'bar-fill' + (pct >= 100 ? ' full' : pct >= 80 ? ' hot' : '')} style={{ width: unlimited ? '4%' : `${pct}%` }} /></div>
    </div>
  );
}

function Billing() {
  const params = useSearchParams();
  const { reload } = useMe();
  const [d, setD] = useState(null);
  const [plan, setPlan] = useState(null);
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  const load = () => api('/billing').then((x) => {
    setD(x);
    setMethod((m) => m || Object.keys(x.accounts)[0] || '');
    return x;
  });

  useEffect(() => {
    load().then((x) => {
      const want = params.get('plan');
      const p = want && x.plans.find((pl) => pl.slug === want);
      if (p) choose(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(p) {
    setPlan(p);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function pay(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = Object.fromEntries(new FormData(e.target));
      await api('/billing', { method: 'POST', body: { ...f, plan_id: plan.id, method } });
      toast('পেমেন্ট জমা হয়েছে — যাচাই করে প্ল্যান চালু করা হবে');
      setPlan(null);
      await load();
      reload();
    } catch (err) {
      toast(err.message, true);
    }
    setBusy(false);
  }

  if (!d) return <div className="empty">লোড হচ্ছে...</div>;
  const sub = d.subscription;
  const pending = d.payments.find((p) => p.status === 'pending');
  const accounts = Object.entries(d.accounts);

  return (
    <>
      <PageHead title="Billing" sub="আপনার প্ল্যান, ব্যবহার ও পেমেন্ট" />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>বর্তমান প্ল্যান</h3>
              <p>{sub ? `${dateOnly(sub.ends_at)} পর্যন্ত — আর ${daysLeft(sub.ends_at)} দিন` : 'কোনো চালু প্ল্যান নেই — বট এখন কোনো উত্তর দিচ্ছে না'}</p>
            </div>
            {sub && <span className={`pill ${sub.status}`}>{sub.plan_name}{sub.status === 'trial' ? ' (Trial)' : ''}</span>}
          </div>
          {sub ? (
            <>
              <Usage label="এই মাসের AI রিপ্লাই" used={d.usage.ai} max={sub.ai_replies} />
              <Usage label="Facebook পেজ" used={d.usage.pages} max={sub.max_pages} />
              <Usage label="প্রোডাক্ট" used={d.usage.products} max={sub.max_products} />
              <Usage label="অটো রিপ্লাই রুল" used={d.usage.rules} max={sub.max_rules} />
              <div className="hint">AI রিপ্লাই লিমিট শেষ হলে অটো রুল ও ডিফল্ট রিপ্লাই চলতে থাকবে।</div>
            </>
          ) : (
            <div className="notice" style={{ margin: 0 }}>নিচে থেকে একটি প্ল্যান বেছে নিয়ে পেমেন্ট করুন।</div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><div><h3>পেমেন্ট হিস্টরি</h3></div></div>
          {!d.payments.length ? (
            <div className="empty">এখনো কোনো পেমেন্ট নেই</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>প্ল্যান</th><th>টাকা</th><th>মেথড</th><th>TrxID</th><th>স্ট্যাটাস</th></tr></thead>
                <tbody>
                  {d.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.plan_name}<div className="hint">{dateOnly(p.created_at)}</div></td>
                      <td>{money(p.amount)}</td>
                      <td>{PAY_METHOD[p.method]}</td>
                      <td><code>{p.trx_id}</code></td>
                      <td><span className={`pill ${p.status}`}>{PAY_STATUS[p.status]}</span>{p.note && <div className="hint">{p.note}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pending && (
        <div className="notice ok">
          আপনার {pending.plan_name} প্ল্যানের পেমেন্ট ({money(pending.amount)}, TrxID <b>{pending.trx_id}</b>) যাচাই হচ্ছে। অনুমোদন হলেই প্ল্যান চালু হবে।
        </div>
      )}

      <div className="plans" style={{ marginBottom: 16 }}>
        {d.plans.map((p) => {
          const current = sub?.plan_id === p.id && sub.status === 'active';
          return (
            <PlanCard key={p.id} plan={p} current={current} featured={plan?.id === p.id}>
              <button className={`btn ${current ? '' : 'primary'} block`} disabled={!!pending} onClick={() => choose(p)}>
                {current ? 'রিনিউ করুন' : sub?.price > p.price && sub.status === 'active' ? 'এই প্ল্যানে যান' : 'এই প্ল্যান কিনুন'}
              </button>
            </PlanCard>
          );
        })}
      </div>

      {plan && (
        <form className="card" ref={formRef} onSubmit={pay}>
          <div className="card-head">
            <div><h3>{plan.name} প্ল্যান — {money(plan.price)}</h3><p>{d.instructions}</p></div>
            <button type="button" className="btn sm" onClick={() => setPlan(null)}>বাতিল</button>
          </div>
          {!accounts.length ? (
            <div className="notice">অ্যাডমিন এখনো পেমেন্ট নম্বর সেট করেননি। সাপোর্টে যোগাযোগ করুন।</div>
          ) : (
            <>
              <div className="pay-accounts">
                {accounts.map(([m, num]) => (
                  <div className={`pay-acc ${m}`} key={m}>
                    <span>{PAY_METHOD[m]} (Send Money)</span>
                    <b>{num}</b>
                  </div>
                ))}
              </div>
              <div className="field">
                <label>কোন মাধ্যমে পাঠিয়েছেন?</label>
                <div className="choice">
                  {accounts.map(([m]) => (
                    <label key={m}><input type="radio" name="m" checked={method === m} onChange={() => setMethod(m)} /> {PAY_METHOD[m]}</label>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="field"><label>যে নম্বর থেকে পাঠিয়েছেন</label><input type="text" name="sender" placeholder="01XXXXXXXXX" required /></div>
                <div className="field"><label>Transaction ID (TrxID)</label><input type="text" name="trx_id" placeholder="যেমন: 9C7A1B2D3E" required /></div>
              </div>
              <button className="btn primary" disabled={busy}>{busy ? 'জমা হচ্ছে...' : `${money(plan.price)} পেমেন্ট জমা দিন`}</button>
            </>
          )}
        </form>
      )}
    </>
  );
}

export default function BillingPage() {
  return <Suspense><Billing /></Suspense>;
}
