'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { api, toast, when, SOURCE } from '@/lib/client';

export function Bubble({ m }) {
  return (
    <div className={`msg-wrap ${m.direction}`}>
      <div className={`msg ${m.direction}`}>{m.text}</div>
      <div className="msg-meta">
        {when(m.created_at)}
        {m.direction === 'out' && <span className={`pill ${m.source}`}>{SOURCE[m.source] || m.source}</span>}
      </div>
    </div>
  );
}

// Chat with the agent as a pretend customer (no Facebook needed)
export default function TestChat({ maxHeight }) {
  const [msgs, setMsgs] = useState([]);
  const [pending, setPending] = useState(null);
  const [text, setText] = useState('');
  const box = useRef(null);

  const load = () => api('/test-chat').then(setMsgs).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, pending]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || pending) return;
    setText('');
    setPending(t);
    try {
      await api('/test-chat', { method: 'POST', body: { text: t } });
    } catch (err) {
      toast(err.message, true);
    }
    await load();
    setPending(null);
  }

  async function reset() {
    await api('/test-chat', { method: 'POST', body: { reset: true } });
    setMsgs([]);
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="avatar"><Icon name="bot" /></div>
        <div style={{ flex: 1 }}>
          <b>AI Agent</b>
          <small><span className="dot" /> Online — টেস্ট চ্যাট</small>
        </div>
        <button className="btn sm" onClick={reset}>রিসেট</button>
      </div>
      <div className="msgs" ref={box} style={{ maxHeight }}>
        {!msgs.length && !pending && (
          <div className="empty">কাস্টমার হিসেবে মেসেজ পাঠিয়ে দেখুন AI কীভাবে উত্তর দেয়।<br />যেমন: &quot;serum er dam koto?&quot;</div>
        )}
        {msgs.map((m) => <Bubble key={m.id} m={m} />)}
        {pending && (
          <>
            <div className="msg-wrap in"><div className="msg in">{pending}</div></div>
            <div className="typing">AI লিখছে...</div>
          </>
        )}
      </div>
      <form className="composer" onSubmit={send}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="কাস্টমার হিসেবে কিছু লিখুন..." />
        <button className="send" disabled={!!pending}><Icon name="send" /></button>
      </form>
    </div>
  );
}
