'use client';

import { useEffect, useState } from 'react';
import { PageHead } from '@/components/Shell';
import TestChat from '@/components/TestChat';
import { api, toast } from '@/lib/client';

export default function AgentPage() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/settings').then(setS); }, []);

  async function save(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.ai_enabled = e.target.ai_enabled.checked ? '1' : '0';
    try {
      await api('/settings', { method: 'PUT', body: d });
      toast('সেভ হয়েছে ✓');
    } catch (err) {
      toast(err.message, true);
    }
  }

  return (
    <>
      <PageHead title="AI Agent" sub="AI এজেন্টকে টেস্ট করুন ও তার আচরণ ঠিক করুন" />
      <div className="grid-2-eq">
        <div className="card" style={{ height: 'calc(100vh - 140px)', minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          <TestChat />
        </div>
        {s && (
          <form className="card" onSubmit={save}>
            <div className="card-head">
              <div><h3>AI সেটিংস</h3><p>রিপ্লাই যায় এই ক্রমে: ১) আপনার Auto Reply রুল → ২) AI এজেন্ট → ৩) ডিফল্ট রিপ্লাই</p></div>
            </div>
            <div className="switch-row">
              <label className="switch"><input type="checkbox" name="ai_enabled" defaultChecked={s.ai_enabled === '1'} /><span /></label>
              <b>AI এজেন্ট চালু</b>
            </div>
            <div className="field">
              <label>এজেন্টের জন্য নির্দেশনা</label>
              <textarea name="ai_instructions" rows={5} defaultValue={s.ai_instructions} />
              <div className="hint">যেমন: কীভাবে কথা বলবে, কোন অফার বলবে, কী বলবে না।</div>
            </div>
            <div className="field">
              <label>ব্যবসার অতিরিক্ত তথ্য (রিটার্ন পলিসি, অফার, ঠিকানা ইত্যাদি)</label>
              <textarea name="business_info" rows={4} defaultValue={s.business_info} />
            </div>
            <div className="form-grid">
              <div className="field"><label>ঢাকার ভিতরে ডেলিভারি (৳)</label><input type="number" name="delivery_inside_dhaka" defaultValue={s.delivery_inside_dhaka} /></div>
              <div className="field"><label>ঢাকার বাইরে ডেলিভারি (৳)</label><input type="number" name="delivery_outside_dhaka" defaultValue={s.delivery_outside_dhaka} /></div>
            </div>
            <div className="field"><label>পেমেন্ট মেথড</label><input type="text" name="payment_methods" defaultValue={s.payment_methods} /></div>
            <div className="field">
              <label>ডিফল্ট রিপ্লাই (AI বন্ধ থাকলে, লিমিট শেষ হলে বা উত্তর দিতে না পারলে)</label>
              <textarea name="fallback_reply" rows={2} defaultValue={s.fallback_reply} />
            </div>
            <button className="btn primary">সেভ করুন</button>
          </form>
        )}
      </div>
    </>
  );
}
