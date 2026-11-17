'use client';

import { useEffect, useState } from 'react';
import { PageHead, useMe } from '@/components/Shell';
import { api, toast } from '@/lib/client';

const SWITCHES = ['pause_on_manual_reply', 'sync_ai_extract', 'notify_order_status', 'followup_enabled'];

export default function SettingsPage() {
  const { me, reload } = useMe();
  const [s, setS] = useState(null);

  useEffect(() => { api('/settings').then(setS); }, []);

  async function save(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    for (const k of SWITCHES) d[k] = e.target[k].checked ? '1' : '0';
    try {
      await api('/settings', { method: 'PUT', body: d });
      toast('সেভ হয়েছে ✓');
      setS(await api('/settings'));
      reload();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await api('/account/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      e.target.reset();
      toast('পাসওয়ার্ড পরিবর্তন হয়েছে ✓');
    } catch (err) {
      toast(err.message, true);
    }
  }

  if (!s) return <div className="empty">লোড হচ্ছে...</div>;

  return (
    <>
      <PageHead title="Settings" sub="আপনার শপের তথ্য ও অ্যাকাউন্ট" />
      <div className="grid-2-eq">
        {/* key forces the uncontrolled inputs to reset after saving */}
        <form key={JSON.stringify(s)} className="stack" onSubmit={save}>
          <div className="card">
            <div className="card-head"><div><h3>ব্যবসার তথ্য</h3><p>বট কাস্টমারকে এই নামে পরিচয় দেবে</p></div></div>
            <div className="field"><label>ব্যবসার নাম</label><input type="text" name="business_name" defaultValue={s.business_name} /></div>
            <div className="field"><label>ট্যাগলাইন</label><input type="text" name="tagline" defaultValue={s.tagline} placeholder="যেমন: যা চাই, সবই পাবো!" /></div>
            <div className="field">
              <label>লোগো URL</label>
              <input type="text" name="logo_url" defaultValue={s.logo_url} placeholder="https://.../logo.png" />
              <div className="hint">আপনার লোগোর ছবির লিংক দিন (Facebook পেজের প্রোফাইল ছবির লিংকও দিতে পারেন)।</div>
            </div>
            <div className="field"><label>ওয়েবসাইট</label><input type="text" name="website_url" defaultValue={s.website_url} placeholder="https://yourshop.com" /></div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>বট ও সিঙ্ক</h3></div></div>
            <div className="switch-row">
              <label className="switch"><input type="checkbox" name="pause_on_manual_reply" defaultChecked={s.pause_on_manual_reply === '1'} /><span /></label>
              আমি নিজে উত্তর দিলে ওই কাস্টমারের বট বন্ধ হয়ে যাবে
            </div>
            <div className="form-grid">
              <div className="field"><label>অটো সিঙ্ক (প্রতি কত ঘণ্টায়, 0 = বন্ধ)</label><input type="number" name="sync_interval_hours" defaultValue={s.sync_interval_hours} /></div>
              <div className="field"><label>সর্বোচ্চ কত পেজ পড়বে</label><input type="number" name="sync_max_pages" defaultValue={s.sync_max_pages} /></div>
            </div>
            <div className="switch-row">
              <label className="switch"><input type="checkbox" name="sync_ai_extract" defaultChecked={s.sync_ai_extract === '1'} /><span /></label>
              <span>AI দিয়ে পেজ পড়া <span className="hint">(সাধারণ ওয়েবসাইটে প্রোডাক্ট ডাটা না পেলে)</span></span>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <div><h3>স্মার্ট ফলো-আপ 🔔</h3><p>দাম জেনে চুপ হয়ে যাওয়া কাস্টমারকে বট নিজেই একবার মনে করিয়ে দেবে — হারানো সেল ফেরত আনে</p></div>
            </div>
            <div className="switch-row">
              <label className="switch"><input type="checkbox" name="followup_enabled" defaultChecked={s.followup_enabled === '1'} /><span /></label>
              অটো ফলো-আপ চালু
            </div>
            <div className="field">
              <label>শেষ মেসেজের কত ঘণ্টা পরে পাঠাবে (১–২০)</label>
              <input type="number" min="1" max="20" name="followup_hours" defaultValue={s.followup_hours} />
            </div>
            <div className="field">
              <label>ফলো-আপ মেসেজ</label>
              <textarea name="followup_text" rows={3} defaultValue={s.followup_text} />
              <div className="hint">{'{name}'} = কাস্টমারের নাম, {'{product}'} = যে প্রোডাক্টের দাম জেনেছিল, {'{price}'} = দাম। Facebook এর নিয়মে কাস্টমারের শেষ মেসেজের ২৪ ঘণ্টার মধ্যেই পাঠানো হয়, একজনকে একবারই।</div>
            </div>
            <div className="hint">গত ৩০ দিনে: <b>{s.followup_stats?.sent || 0}</b>টি ফলো-আপ পাঠানো হয়েছে, এর থেকে <b>{s.followup_stats?.won || 0}</b>টি অর্ডার এসেছে।</div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>অর্ডার ও কুরিয়ার</h3><p>অর্ডারের স্ট্যাটাস বদলালে কাস্টমারকে জানানো আর Steadfast এ এক ক্লিকে পার্সেল বুক</p></div></div>
            <div className="switch-row">
              <label className="switch"><input type="checkbox" name="notify_order_status" defaultChecked={s.notify_order_status === '1'} /><span /></label>
              অর্ডার কনফার্ম / শিপড / ডেলিভারড হলে কাস্টমারকে Messenger এ জানাবে
            </div>
            <div className="form-grid">
              <div className="field"><label>Steadfast API Key</label><input type="password" name="steadfast_api_key" defaultValue={s.steadfast_api_key} autoComplete="off" /></div>
              <div className="field"><label>Steadfast Secret Key</label><input type="password" name="steadfast_secret_key" defaultValue={s.steadfast_secret_key} autoComplete="off" /></div>
            </div>
            <div className="hint">Steadfast প্যানেল → API সেটিংস থেকে কী দুটো নিন। দিলে Orders পেজে প্রতিটি অর্ডারের পাশে 🚚 বাটন কাজ করবে।</div>
          </div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }}>সেভ করুন</button>
        </form>

        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h3>অ্যাকাউন্ট</h3></div></div>
            <p style={{ margin: '0 0 6px' }}><b>{me?.user.name}</b></p>
            <p className="hint" style={{ margin: 0 }}>{me?.user.email}{me?.user.phone ? ` · ${me.user.phone}` : ''}</p>
          </div>
          <form className="card" onSubmit={changePassword}>
            <div className="card-head"><div><h3>পাসওয়ার্ড পরিবর্তন</h3></div></div>
            <div className="field"><label>বর্তমান পাসওয়ার্ড</label><input type="password" name="current" required /></div>
            <div className="field"><label>নতুন পাসওয়ার্ড</label><input type="password" name="next" minLength={6} required /></div>
            <button className="btn">পরিবর্তন করুন</button>
          </form>
        </div>
      </div>
    </>
  );
}
