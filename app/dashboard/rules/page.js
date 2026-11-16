'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { PageHead, useMe } from '@/components/Shell';
import { api, toast, limitText } from '@/lib/client';

const MATCH = { contains: 'মেসেজে থাকলে', exact: 'হুবহু মিললে', starts: 'শুরুতে থাকলে' };

function RuleForm({ r = {} }) {
  return (
    <>
      <div className="field"><label>রুলের নাম</label><input type="text" name="name" defaultValue={r.name} placeholder="যেমন: ডেলিভারি চার্জ" /></div>
      <div className="field">
        <label>কীওয়ার্ড (কমা দিয়ে আলাদা)</label>
        <textarea name="keywords" rows={2} required defaultValue={r.keywords} placeholder="delivery charge, ডেলিভারি চার্জ, delivery koto" />
      </div>
      <div className="form-grid">
        <div className="field">
          <label>মিলবে যখন</label>
          <select name="match_type" defaultValue={r.match_type || 'contains'}>
            {Object.entries(MATCH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>অগ্রাধিকার (বেশি = আগে)</label><input type="number" name="priority" defaultValue={r.priority ?? 0} /></div>
      </div>
      <div className="field"><label>রিপ্লাই</label><textarea name="reply" rows={4} required defaultValue={r.reply} /></div>
      <div className="switch-row">
        <label className="switch"><input type="checkbox" name="active" defaultChecked={r.active !== 0} /><span /></label> চালু
      </div>
    </>
  );
}

export default function RulesPage() {
  const { me } = useMe();
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | rule
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(undefined);

  const load = () => api('/rules').then(setRules);
  useEffect(() => { load(); }, []);

  async function save(d) {
    if (editing.id) await api('/rules/' + editing.id, { method: 'PUT', body: d });
    else await api('/rules', { method: 'POST', body: d });
    toast('সেভ হয়েছে ✓');
    load();
  }
  async function toggle(r) {
    await api('/rules/' + r.id, { method: 'PUT', body: { active: !r.active } });
    load();
  }
  async function remove(r) {
    if (!confirm('রুলটি ডিলিট করবেন?')) return;
    await api('/rules/' + r.id, { method: 'DELETE' });
    load();
  }
  async function test(e) {
    e.preventDefault();
    const { rule } = await api('/rules/test', { method: 'POST', body: { text: testText } });
    setTestResult(rule);
  }

  const max = me?.subscription?.max_rules;

  return (
    <>
      <PageHead title="Auto Reply" sub={`কোন মেসেজে কী রিপ্লাই যাবে আগে থেকে ঠিক করে দিন। রুল মিললে AI এর আগে এই রিপ্লাই যাবে। (${rules.length} / ${limitText(max)})`}>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" /> নতুন রুল</button>
      </PageHead>

      <div className="grid-2">
        <div className="card">
          {!rules.length && <div className="empty">কোনো রুল নেই</div>}
          {rules.map((r) => (
            <div className="rule" key={r.id}>
              <div>
                <div className="row">
                  <b>{r.name || `রুল #${r.id}`}</b>
                  <span className={`pill ${r.active ? 'on' : 'off'}`}>{r.active ? 'চালু' : 'বন্ধ'}</span>
                  <span className="meta">{MATCH[r.match_type]} · অগ্রাধিকার {r.priority} · {r.hits} বার ব্যবহার</span>
                </div>
                <div className="kw">{r.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => <span key={k}>{k}</span>)}</div>
                <div className="reply-box">{r.reply}</div>
              </div>
              <div className="actions">
                <button className="btn sm" onClick={() => setEditing(r)}>এডিট</button>
                <button className="btn sm" onClick={() => toggle(r)}>{r.active ? 'বন্ধ' : 'চালু'}</button>
                <button className="btn sm danger" onClick={() => remove(r)}>ডিলিট</button>
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h3>রুল টেস্ট করুন</h3><p>একটা মেসেজ লিখে দেখুন কোন রুল মিলে</p></div></div>
            <form className="row" onSubmit={test}>
              <input className="grow" type="text" value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="যেমন: delivery charge koto?" />
              <button className="btn">টেস্ট</button>
            </form>
            {testResult !== undefined && (
              <div className="hint" style={{ marginTop: 10 }}>
                {testResult ? (
                  <>✓ মিলেছে: <b>{testResult.name || `#${testResult.id}`}</b><div className="reply-box" style={{ marginTop: 6 }}>{testResult.reply}</div></>
                ) : (
                  'কোনো রুল মিলেনি → AI এজেন্ট উত্তর দেবে।'
                )}
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>টিপস</h3>
            <ul className="steps">
              <li>কমা দিয়ে একাধিক কীওয়ার্ড দিন — বাংলা, Banglish, English সব।</li>
              <li><b>হুবহু মিললে</b> — &quot;hi&quot; শুধু &quot;hi&quot; লিখলেই মিলবে, &quot;hi dam koto&quot; তে নয়।</li>
              <li>রিপ্লাইতে ব্যবহার করুন: <code>{'{name}'}</code> <code>{'{business}'}</code> <code>{'{delivery_inside}'}</code> <code>{'{delivery_outside}'}</code> <code>{'{payment}'}</code> <code>{'{website}'}</code></li>
              <li>দাম/স্টকের প্রশ্নের জন্য রুল লাগবে না — AI নিজেই প্রোডাক্ট ডাটাবেস থেকে উত্তর দেবে।</li>
            </ul>
          </div>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'রুল এডিট' : 'নতুন রুল'} onSubmit={save} onClose={() => setEditing(null)}>
          <RuleForm r={editing} />
        </Modal>
      )}
    </>
  );
}
