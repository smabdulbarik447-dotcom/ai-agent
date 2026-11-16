'use client';

import { useEffect, useState } from 'react';
import { PageHead } from '@/components/Shell';
import { api, toast } from '@/lib/client';

function Copy({ value }) {
  return (
    <div className="copy">
      <input type="text" readOnly value={value} />
      <button type="button" className="btn sm" onClick={() => { navigator.clipboard.writeText(value); toast('কপি হয়েছে'); }}>কপি</button>
    </div>
  );
}

function uptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d} দিন ${h} ঘণ্টা` : h ? `${h} ঘণ্টা ${m} মিনিট` : `${m} মিনিট`;
}

function ServerCard() {
  const [sys, setSys] = useState(null);
  useEffect(() => { api('/admin/system').then(setSys).catch(() => {}); }, []);
  if (!sys) return null;
  return (
    <div className="card">
      <div className="card-head">
        <div><h3>সার্ভার ও ব্যাকআপ</h3><p>চালু আছে {uptime(sys.uptimeSec)} · Node {sys.node} · RAM {sys.memoryMb} MB</p></div>
        <a className="btn primary sm" href="/api/admin/backup">ব্যাকআপ ডাউনলোড</a>
      </div>
      {!sys.persistentDir && (
        <div className="notice" style={{ marginBottom: 10 }}>
          DATA_DIR সেট করা নেই — ক্লাউড হোস্টিং এ (Railway) রিডিপ্লয় করলে ডাটা মুছে যেতে পারে। একটি Volume যুক্ত করে DATA_DIR=/data দিন।
        </div>
      )}
      <div className="list">
        <div className="li"><div className="t"><b>ডাটাবেস</b><span>{sys.dataDir}</span></div><b>{sys.dbSizeMb} MB</b></div>
        <div className="li"><div className="t"><b>রেকর্ড</b></div>
          <span className="hint" style={{ margin: 0 }}>{sys.rows.users} ইউজার · {sys.rows.products} প্রোডাক্ট · {sys.rows.messages} মেসেজ · {sys.rows.orders} অর্ডার</span>
        </div>
      </div>
      <div className="hint">সপ্তাহে অন্তত একবার ব্যাকআপ ডাউনলোড করে নিজের কাছে রাখুন।</div>
    </div>
  );
}

export default function PlatformSettings() {
  const [s, setS] = useState(null);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    api('/admin/settings').then(setS);
    api('/admin/plans').then(setPlans);
  }, []);

  async function save(e) {
    e.preventDefault();
    try {
      await api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      toast('সেভ হয়েছে ✓');
      setS(await api('/admin/settings'));
    } catch (err) {
      toast(err.message, true);
    }
  }

  if (!s) return <div className="empty">লোড হচ্ছে...</div>;

  return (
    <>
      <PageHead title="Platform Settings" sub="Facebook App, AI, পেমেন্ট নম্বর ও ট্রায়াল — সব ইউজারের জন্য" />
      {/* key forces the uncontrolled inputs to reset after saving */}
      <form key={JSON.stringify(s)} className="grid-2-eq" onSubmit={save}>
        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h3>Facebook App (Meta)</h3><p>সব ইউজারের পেজ এই একটি App দিয়ে কানেক্ট হবে</p></div></div>
            <div className="field">
              <label>পাবলিক URL (আপনার ডোমেইন)</label>
              <input type="text" name="public_url" defaultValue={s.public_url} placeholder="https://bot.yourdomain.com" />
              <div className="hint">খালি রাখলে ব্রাউজারের ঠিকানা থেকে নেবে। Facebook এর জন্য https লাগবে।</div>
            </div>
            <div className="field"><label>Webhook Callback URL (Meta App → Messenger → Webhooks)</label><Copy value={s.webhook_url} /></div>
            <div className="field"><label>OAuth Redirect URI (Meta App → Facebook Login → Settings → Valid OAuth Redirect URIs)</label><Copy value={s.oauth_redirect} /></div>
            <div className="form-grid">
              <div className="field"><label>App ID</label><input type="text" name="fb_app_id" defaultValue={s.fb_app_id} /></div>
              <div className="field"><label>App Secret</label><input type="password" name="fb_app_secret" defaultValue={s.fb_app_secret} /></div>
            </div>
            <div className="field">
              <label>Webhook Verify Token</label>
              <input type="text" name="fb_verify_token" defaultValue={s.fb_verify_token} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Meta App সেটআপের ধাপ</h3>
            <ol className="steps">
              <li><a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com</a> এ একটি <b>Business</b> টাইপ App তৈরি করুন।</li>
              <li><b>Facebook Login for Business</b> ও <b>Messenger</b> প্রোডাক্ট যোগ করুন।</li>
              <li>Facebook Login → Settings এ উপরের <b>OAuth Redirect URI</b> দিন।</li>
              <li>Messenger → Webhooks এ <b>Callback URL</b> ও <b>Verify Token</b> দিন, <code>messages</code>, <code>messaging_postbacks</code>, <code>message_echoes</code> সাবস্ক্রাইব করুন।</li>
              <li>App ID ও App Secret (Settings → Basic) এখানে দিন।</li>
              <li>ইউজাররা যাতে নিজেদের পেজ কানেক্ট করতে পারে, তার জন্য <code>pages_messaging</code>, <code>pages_manage_metadata</code>, <code>pages_show_list</code> পারমিশনের <b>App Review</b> করান এবং App টি <b>Live</b> করুন। রিভিউ পাওয়ার আগে শুধু App এ Tester হিসেবে যোগ করা ইউজাররাই কানেক্ট করতে পারবে।</li>
            </ol>
          </div>
        </div>

        <div className="stack">
          <ServerCard />
          <div className="card">
            <div className="card-head"><div><h3>ব্র্যান্ড</h3></div></div>
            <div className="form-grid">
              <div className="field"><label>প্ল্যাটফর্মের নাম</label><input type="text" name="brand_name" defaultValue={s.brand_name} /></div>
              <div className="field"><label>ট্যাগলাইন</label><input type="text" name="brand_tagline" defaultValue={s.brand_tagline} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>AI (Claude)</h3><p>সব ইউজারের বট এই key দিয়ে চলবে — খরচ আপনার, প্ল্যানের লিমিট দিয়ে নিয়ন্ত্রিত</p></div></div>
            <div className="field"><label>Claude API Key</label><input type="password" name="anthropic_api_key" defaultValue={s.anthropic_api_key} placeholder="sk-ant-..." /></div>
            <div className="form-grid">
              <div className="field">
                <label>AI মডেল</label>
                <select name="ai_model" defaultValue={s.ai_model}>
                  <option value="claude-opus-5-5">Claude Opus 5.5 (সেরা মান)</option>
                  <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (কম খরচ)</option>
                  <option value="claude-haiku-5-5">Claude Haiku 5.5 (সবচেয়ে সস্তা)</option>
                </select>
              </div>
              <div className="field">
                <label>Effort</label>
                <select name="ai_effort" defaultValue={s.ai_effort}>
                  {['low', 'medium', 'high'].map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>পেমেন্ট নম্বর</h3><p>ইউজাররা এই নম্বরে Send Money করে TrxID জমা দেবে। খালি রাখলে সেই মেথড দেখাবে না।</p></div></div>
            <div className="form-grid">
              <div className="field"><label>বিকাশ</label><input type="text" name="pay_bkash" defaultValue={s.pay_bkash} placeholder="01XXXXXXXXX" /></div>
              <div className="field"><label>নগদ</label><input type="text" name="pay_nagad" defaultValue={s.pay_nagad} placeholder="01XXXXXXXXX" /></div>
              <div className="field"><label>রকেট</label><input type="text" name="pay_rocket" defaultValue={s.pay_rocket} placeholder="01XXXXXXXXXX" /></div>
            </div>
            <div className="field"><label>পেমেন্ট নির্দেশনা</label><textarea name="pay_instructions" rows={2} defaultValue={s.pay_instructions} /></div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>ফ্রি ট্রায়াল</h3><p>নতুন অ্যাকাউন্ট খুললে স্বয়ংক্রিয়ভাবে</p></div></div>
            <div className="form-grid">
              <div className="field"><label>কত দিন (0 = ট্রায়াল নেই)</label><input type="number" name="trial_days" defaultValue={s.trial_days} min={0} /></div>
              <div className="field">
                <label>কোন প্ল্যানের ট্রায়াল</label>
                <select name="trial_plan" defaultValue={s.trial_plan}>
                  {plans.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }}>সব সেভ করুন</button>
        </div>
      </form>
    </>
  );
}
