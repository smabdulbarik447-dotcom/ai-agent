'use client';

import { useEffect, useState } from 'react';
import { api, toast, when } from '@/lib/client';

// Settings + recent log for automatic replies to Facebook post comments
export default function CommentsCard() {
  const [s, setS] = useState(null);
  const [log, setLog] = useState([]);

  const load = () => {
    api('/settings').then(setS);
    api('/comments').then(setLog).catch(() => {});
  };
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          comment_reply_enabled: f.comment_reply_enabled.checked ? '1' : '0',
          comment_dm_enabled: f.comment_dm_enabled.checked ? '1' : '0',
          comment_public_reply: f.comment_public_reply.value,
        },
      });
      toast('সেভ হয়েছে ✓');
    } catch (err) {
      toast(err.message, true);
    }
  }

  if (!s) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <h3>💬 পোস্টের কমেন্টে অটো রিপ্লাই</h3>
          <p>কেউ পোস্টে &quot;price?&quot; / &quot;dam koto&quot; লিখলে বট কমেন্টে উত্তর দেবে আর ইনবক্সে ওই পোস্টের প্রোডাক্টের দাম, অফার ও বিবরণ পাঠাবে।</p>
        </div>
      </div>
      <form onSubmit={save}>
        <div className="switch-row">
          <label className="switch"><input type="checkbox" name="comment_reply_enabled" defaultChecked={s.comment_reply_enabled === '1'} /><span /></label>
          কমেন্টে অটো রিপ্লাই চালু
        </div>
        <div className="switch-row">
          <label className="switch"><input type="checkbox" name="comment_dm_enabled" defaultChecked={s.comment_dm_enabled === '1'} /><span /></label>
          বিস্তারিত ইনবক্সে পাঠাবে (বন্ধ থাকলে কমেন্টেই দাম লিখে দেবে)
        </div>
        <div className="field">
          <label>কমেন্টের নিচে যে রিপ্লাই যাবে (ইনবক্সে পাঠানো হলে)</label>
          <input type="text" name="comment_public_reply" defaultValue={s.comment_public_reply} />
          <div className="hint"><code>{'{name}'}</code> = যে কমেন্ট করেছে তার নাম</div>
        </div>
        <button className="btn primary">সেভ করুন</button>
      </form>

      {log.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>কমেন্ট</th><th>বটের উত্তর</th><th>সময়</th></tr></thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.from_name || 'Facebook User'}</b><div className="hint">{r.message}</div></td>
                  <td style={{ maxWidth: 380 }}>
                    {r.public_reply && <div>💬 {r.public_reply}</div>}
                    {r.dm_text && <div className="hint">📩 {r.dm_text}</div>}
                    {r.error && <div className="hint" style={{ color: 'var(--red)' }}>⚠️ {r.error}</div>}
                  </td>
                  <td className="hint" style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="hint" style={{ marginTop: 10 }}>
        নোট: আগে কানেক্ট করা পেজে কমেন্ট রিপ্লাই চালু করতে পেজটি একবার &quot;ডিসকানেক্ট&quot; করে আবার কানেক্ট করুন (নতুন পারমিশন লাগে)।
      </div>
    </div>
  );
}
