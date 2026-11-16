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

  if (!data) return <div className="empty">লোড হচ্ছে...</div>;

  return (
    <>
      <PageHead title="Facebook Pages" sub={`যে পেজগুলোতে বট কাস্টমারের মেসেজের উত্তর দেবে (${data.pages.length} / ${limitText(data.maxPages)})`}>
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
        <div className="card-head"><div><h3>কানেক্টেড পেজ</h3></div></div>
        {!data.pages.length ? (
          <div className="empty">
            এখনো কোনো পেজ কানেক্ট করা হয়নি।
            {data.oauth && <><br /><br /><a className="btn fb-btn" href="/api/fb/connect"><Icon name="fb" /> Facebook দিয়ে কানেক্ট করুন</a></>}
          </div>
        ) : (
          <div className="list">
            {data.pages.map((p) => (
              <div className="li" key={p.id}>
                <div className="avatar"><Icon name="fb" /></div>
                <div className="t"><b>{p.name}</b><span>ID: {p.page_id} · কানেক্ট: {when(p.created_at)}</span></div>
                <span className="hint" style={{ margin: 0 }}>বট</span>
                <label className="switch"><input type="checkbox" checked={!!p.active} onChange={() => toggle(p)} /><span /></label>
                <button className="btn sm danger" disabled={!!busy} onClick={() => remove(p)}>ডিসকানেক্ট</button>
              </div>
            ))}
          </div>
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
