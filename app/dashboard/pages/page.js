'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { PageHead } from '@/components/Shell';
import CommentsCard from '@/components/CommentsCard';
import { api, toast, when, limitText } from '@/lib/client';

function Pages() {
  const params = useSearchParams();
  const [data, setData] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [manual, setManual] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  const load = () => api('/pages').then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => { if (params.get('error')) toast(params.get('error'), true); }, [params]);

  async function run(key, fn, ok) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
      await load();
    } catch (e) {
      toast(e.message, true);
    }
    setBusy('');
  }

  const connectOption = (id) => run(id, () => api('/pages/connect', { method: 'POST', body: { page_id: id } }), 'পেজ কানেক্ট হয়েছে ✓');
  const toggle = (p) => run('t' + p.id, () => api('/pages/' + p.id, { method: 'PUT', body: { active: !p.active } }));
  const remove = (p) => confirm(`"${p.name}" পেজটি ডিসকানেক্ট করবেন?`) && run('d' + p.id, () => api('/pages/' + p.id, { method: 'DELETE' }), 'ডিসকানেক্ট হয়েছে');
  const addManual = (e) => {
    e.preventDefault();
    run('manual', () => api('/pages', { method: 'POST', body: { token } }).then(() => setToken('')), 'পেজ কানেক্ট হয়েছে ✓');
  };

  const addWhatsApp = (e) => {
    e.preventDefault();
    const form = e.target;
    const d = Object.fromEntries(new FormData(form));
    run('wa', () => api('/pages/whatsapp', { method: 'POST', body: d }).then(() => { form.reset(); setWaOpen(false); }), 'WhatsApp নম্বর কানেক্ট হয়েছে ✓');
  };
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('কপি হয়েছে'));

  if (!data) return <div className="empty">লোড হচ্ছে...</div>;

  return (
    <>
      <PageHead title="Pages & WhatsApp" sub={`যে Facebook পেজ ও WhatsApp নম্বরে বট কাস্টমারের মেসেজের উত্তর দেবে (${data.pages.length} / ${limitText(data.maxPages)})`}>
        {data.oauth && (
          <a className="btn fb-btn" href="/api/fb/connect"><Icon name="fb" /> Facebook দিয়ে কানেক্ট করুন</a>
        )}
      </PageHead>

      {!data.oauth && (
        <div className="notice">অ্যাডমিন এখনো Facebook App সেটআপ করেননি, তাই এক-ক্লিক কানেক্ট বন্ধ আছে। নিচে Page Access Token দিয়ে কানেক্ট করতে পারেন।</div>
      )}

      {data.options.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head"><div><h3>কোন পেজ কানেক্ট করবেন?</h3><p>Facebook থেকে আপনার এই পেজগুলো পাওয়া গেছে</p></div></div>
          <div className="list">
            {data.options.map((o) => (
              <div className="li" key={o.id}>
                <div className="avatar"><Icon name="fb" /></div>
                <div className="t"><b>{o.name}</b><span>ID: {o.id}</span></div>
                <button className="btn primary sm" disabled={!!busy} onClick={() => connectOption(o.id)}>
                  {busy === o.id ? 'কানেক্ট হচ্ছে...' : 'কানেক্ট'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><div><h3>কানেক্টেড পেজ ও নম্বর</h3></div></div>
        {!data.pages.length ? (
          <div className="empty">
            এখনো কোনো পেজ কানেক্ট করা হয়নি।
            {data.oauth && <><br /><br /><a className="btn fb-btn" href="/api/fb/connect"><Icon name="fb" /> Facebook দিয়ে কানেক্ট করুন</a></>}
          </div>
        ) : (
          <div className="list">
            {data.pages.map((p) => (
              <div className="li" key={p.id}>
                <div className={`avatar ${p.channel === 'whatsapp' ? 'wa' : ''}`}>{p.channel === 'whatsapp' ? <Icon name="wa" /> : <Icon name="fb" />}</div>
                <div className="t"><b>{p.name}</b><span>{p.channel === 'whatsapp' ? 'WhatsApp' : 'Messenger'} · ID: {p.page_id} · কানেক্ট: {when(p.created_at)}</span></div>
                <span className="hint" style={{ margin: 0 }}>বট</span>
                <label className="switch"><input type="checkbox" checked={!!p.active} onChange={() => toggle(p)} /><span /></label>
                <button className="btn sm danger" disabled={!!busy} onClick={() => remove(p)}>ডিসকানেক্ট</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div><h3>WhatsApp নম্বর কানেক্ট করুন</h3><p>WhatsApp এও একই AI উত্তর দেবে — প্রোডাক্টের দাম, ছবি চেনা, অর্ডার, কনফার্ম বাটন, ফলো-আপ সব</p></div>
          <button className="btn sm wa-btn" onClick={() => setWaOpen((o) => !o)}><Icon name="wa" /> {waOpen ? 'লুকান' : 'কানেক্ট করুন'}</button>
        </div>
        {waOpen && (
          <>
            <ol className="steps">
              <li><a className="link" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com</a> → Create App (Business) → <b>WhatsApp</b> যোগ করুন, আপনার ব্যবসার নম্বর অ্যাড ও ভেরিফাই করুন।</li>
              <li>WhatsApp → <b>API Setup</b> থেকে <b>Phone Number ID</b> আর <b>WhatsApp Business Account ID</b> কপি করুন।</li>
              <li>Business Settings → System Users → একটি System User বানিয়ে <code>whatsapp_business_messaging</code> ও <code>whatsapp_business_management</code> পারমিশনসহ <b>স্থায়ী (permanent) টোকেন</b> তৈরি করুন।</li>
              <li>
                WhatsApp → <b>Configuration → Webhook</b> এ বসান — Callback URL: <code>{data.whatsapp.webhookUrl}</code> <button type="button" className="btn sm" onClick={() => copy(data.whatsapp.webhookUrl)}>কপি</button>
                {' '}Verify token: <code>{data.whatsapp.verifyToken}</code> <button type="button" className="btn sm" onClick={() => copy(data.whatsapp.verifyToken)}>কপি</button>
                {' '}তারপর <b>messages</b> ফিল্ড Subscribe করুন।
              </li>
              <li>নিচের ঘরগুলো পূরণ করে কানেক্ট চাপুন।</li>
            </ol>
            <form onSubmit={addWhatsApp}>
              <div className="form-grid">
                <div className="field"><label>Phone Number ID</label><input type="text" name="phone_id" inputMode="numeric" required placeholder="1234567890..." /></div>
                <div className="field"><label>WhatsApp Business Account ID</label><input type="text" name="waba_id" inputMode="numeric" required placeholder="1029384756..." /></div>
              </div>
              <div className="field"><label>Permanent Access Token</label><input type="password" name="token" required placeholder="EAAG..." autoComplete="off" /></div>
              <div className="field">
                <label>App Secret (নিজের Meta App হলে)</label>
                <input type="password" name="app_secret" placeholder="App Settings → Basic → App Secret" autoComplete="off" />
                <div className="hint">নিজের Meta App দিয়ে কানেক্ট করলে দিন — এটা দিয়ে মেসেজগুলো আসলেই Meta থেকে আসছে কিনা যাচাই হয়।</div>
              </div>
              <button className="btn primary" disabled={busy === 'wa'}>{busy === 'wa' ? 'যাচাই হচ্ছে...' : 'WhatsApp কানেক্ট করুন'}</button>
            </form>
          </>
        )}
      </div>

      <CommentsCard />

      <div className="card">
        <div className="card-head">
          <div><h3>Page Access Token দিয়ে কানেক্ট (অ্যাডভান্সড)</h3><p>এক-ক্লিক কানেক্ট কাজ না করলে এটা ব্যবহার করুন</p></div>
          <button className="btn sm" onClick={() => setManual((m) => !m)}>{manual ? 'লুকান' : 'দেখান'}</button>
        </div>
        {manual && (
          <form onSubmit={addManual}>
            <div className="field">
              <label>Page Access Token</label>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG..." required />
              <div className="hint">টোকেনটি অবশ্যই এই প্ল্যাটফর্মের Facebook App থেকে তৈরি হতে হবে। দরকার হলে সাপোর্টে যোগাযোগ করুন।</div>
            </div>
            <button className="btn primary" disabled={busy === 'manual'}>{busy === 'manual' ? 'যাচাই হচ্ছে...' : 'কানেক্ট করুন'}</button>
          </form>
        )}
      </div>
    </>
  );
}

export default function PagesPage() {
  return <Suspense><Pages /></Suspense>;
}
