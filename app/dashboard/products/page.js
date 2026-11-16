'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { PageHead, useMe } from '@/components/Shell';
import { api, money, toast, when, limitText, STOCK } from '@/lib/client';

function ProductForm({ p = {} }) {
  return (
    <>
      <div className="field"><label>নাম</label><input type="text" name="name" defaultValue={p.name} required /></div>
      <div className="form-grid">
        <div className="field"><label>দাম (৳)</label><input type="number" step="any" name="price" defaultValue={p.price ?? ''} /></div>
        <div className="field"><label>আগের দাম (৳)</label><input type="number" step="any" name="regular_price" defaultValue={p.regular_price ?? ''} /></div>
        <div className="field">
          <label>স্টক</label>
          <select name="stock_status" defaultValue={p.stock_status || 'in_stock'}>
            {Object.entries(STOCK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>স্টক সংখ্যা</label><input type="number" name="stock_qty" defaultValue={p.stock_qty ?? ''} /></div>
        <div className="field"><label>ক্যাটাগরি</label><input type="text" name="category" defaultValue={p.category ?? ''} /></div>
        <div className="field"><label>SKU</label><input type="text" name="sku" defaultValue={p.sku ?? ''} /></div>
      </div>
      <div className="field"><label>বিবরণ</label><textarea name="description" rows={4} defaultValue={p.description ?? ''} /></div>
      <div className="field"><label>প্রোডাক্ট লিংক</label><input type="text" name="url" defaultValue={p.url ?? ''} /></div>
      <div className="field"><label>ছবির লিংক</label><input type="text" name="image" defaultValue={p.image ?? ''} /></div>
      <div className="switch-row">
        <label className="switch"><input type="checkbox" name="active" defaultChecked={p.active !== 0} /><span /></label> AI এই প্রোডাক্ট দেখাবে
      </div>
    </>
  );
}

export default function ProductsPage() {
  const { me } = useMe();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [stock, setStock] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setIntervalHours] = useState('6');
  const [sync, setSync] = useState({ running: false, progress: '', logs: [] });
  const [editing, setEditing] = useState(null);

  const load = useCallback(
    () => api(`/products?q=${encodeURIComponent(q)}&stock=${stock}`).then(setProducts),
    [q, stock]
  );

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api('/settings').then((s) => { setUrl(s.website_url); setIntervalHours(s.sync_interval_hours); });
    api('/sync/status').then(setSync);
  }, []);

  // Poll progress while a sync is running
  useEffect(() => {
    if (!sync.running) return;
    const t = setInterval(async () => {
      const s = await api('/sync/status');
      setSync(s);
      if (!s.running) load();
    }, 1500);
    return () => clearInterval(t);
  }, [sync.running, load]);

  async function startSync(e) {
    e.preventDefault();
    // "www.shop.com" or "shop.com" works too: add https:// when it's missing
    const clean = url.trim().replace(/\s+/g, ''); // remove spaces only
    const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    setUrl(full);
    try {
      await api('/sync', { method: 'POST', body: { url: full } });
      toast('সিঙ্ক শুরু হয়েছে');
      setSync((s) => ({ ...s, running: true, progress: 'শুরু হচ্ছে...' }));
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function save(d) {
    d.active = d.active ? 1 : 0;
    if (editing.id) await api('/products/' + editing.id, { method: 'PUT', body: d });
    else await api('/products', { method: 'POST', body: d });
    toast('সেভ হয়েছে ✓');
    load();
  }

  async function remove(p) {
    if (!confirm('প্রোডাক্টটি ডিলিট করবেন?')) return;
    await api('/products/' + p.id, { method: 'DELETE' });
    load();
  }

  const last = sync.logs?.[0];
  const status = sync.progress || (last ? `শেষ সিঙ্ক: ${when(last.started_at)} — ${last.found}টি প্রোডাক্ট (${last.method || ''}) ${last.message || ''}` : '');
  const max = me?.subscription?.max_products;

  return (
    <>
      <PageHead title="Products" sub={`আপনার ওয়েবসাইট থেকে সব প্রোডাক্ট, দাম ও স্টক — AI এখান থেকেই উত্তর দেয়। প্ল্যান লিমিট: ${limitText(max)}`}>
        <button className="btn" onClick={() => setEditing({})}><Icon name="plus" /> নিজে যোগ করুন</button>
      </PageHead>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <h3>ওয়েবসাইট থেকে সিঙ্ক</h3>
            <p>Shopify, WooCommerce বা যেকোনো ওয়েবসাইট — প্রোডাক্ট পেজ পড়ে নিজের ডাটাবেসে রাখবে। প্রতি {interval} ঘণ্টায় অটো আপডেট হয়।</p>
          </div>
        </div>
        <form className="row" onSubmit={startSync}>
          <input className="grow" type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourshop.com" required />
          <button className="btn orange" disabled={sync.running}>
            <Icon name="refresh" /> {sync.running ? 'সিঙ্ক চলছে...' : 'এখনই সিঙ্ক করুন'}
          </button>
        </form>
        {status && <div className="hint" style={{ marginTop: 8 }}>{status}</div>}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="grow" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." />
          <select value={stock} onChange={(e) => setStock(e.target.value)} style={{ width: 'auto' }}>
            <option value="">সব স্টক</option>
            {Object.entries(STOCK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {products.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Source</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                      <td>
                        <div className="prod">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.image ? <img className="thumb" src={p.image} alt="" loading="lazy" /> : <div className="thumb" />}
                          <div>
                            <div className="n">{p.name}</div>
                            <div className="s">{p.category}{p.sku ? ` · ${p.sku}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <b>{money(p.price)}</b>
                        {p.regular_price > p.price && <div className="hint"><s>{money(p.regular_price)}</s></div>}
                      </td>
                      <td>
                        <span className={`pill ${p.stock_status}`}>{STOCK[p.stock_status] || p.stock_status}</span>
                        {p.stock_qty != null && <div className="hint">{p.stock_qty}টি</div>}
                      </td>
                      <td className="hint">{p.source}</td>
                      <td className="hint" style={{ whiteSpace: 'nowrap' }}>{when(p.updated_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn sm" onClick={() => setEditing(p)}>এডিট</button>{' '}
                        <button className="btn sm danger" onClick={() => remove(p)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>{products.length}টি প্রোডাক্ট দেখানো হচ্ছে</div>
          </>
        ) : (
          <div className="empty">কোনো প্রোডাক্ট নেই। উপরে আপনার ওয়েবসাইটের লিংক দিয়ে সিঙ্ক করুন।</div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? 'প্রোডাক্ট এডিট' : 'নতুন প্রোডাক্ট'} onSubmit={save} onClose={() => setEditing(null)}>
          <ProductForm p={editing} />
        </Modal>
      )}
    </>
  );
}
