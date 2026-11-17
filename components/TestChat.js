'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { api, toast, when, SOURCE } from '@/lib/client';

export function Bubble({ m, onTeach }) {
  return (
    <div className={`msg-wrap ${m.direction}`}>
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={m.image_url} target="_blank" rel="noreferrer"><img className="msg-img" src={m.image_url} alt="" /></a>
      )}
      {m.text && <div className={`msg ${m.direction}`}>{m.text}</div>}
      <div className="msg-meta">
        {when(m.created_at)}
        {m.direction === 'out' && <span className={`pill src-${m.source}`}>{SOURCE[m.source] || m.source}</span>}
        {onTeach && m.direction === 'in' && m.text && (
          <button className="teach-btn" onClick={() => onTeach(m)} title="এই প্রশ্নের সঠিক উত্তর AI কে শিখিয়ে দিন">✨ উত্তর শেখান</button>
        )}
      </div>
    </div>
  );
}

/** Shrink a photo in the browser so uploads stay small (max 1280px, JPEG). */
export function resizeImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('ছবিটি খোলা যায়নি'));
    img.src = URL.createObjectURL(file);
  });
}

// Chat with the agent as a pretend customer (no Facebook needed)
export default function TestChat({ maxHeight }) {
  const [msgs, setMsgs] = useState([]);
  const [pending, setPending] = useState(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [quick, setQuick] = useState([]); // Messenger quick-reply buttons under the last answer
  const box = useRef(null);
  const fileRef = useRef(null);

  const load = () => api('/test-chat').then(setMsgs).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, pending]);

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setPhoto(await resizeImage(f));
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function send(e, button) {
    e?.preventDefault();
    const t = button ? button.title : text.trim();
    if ((!t && !photo) || pending) return;
    if (!button) setText('');
    setQuick([]);
    setPending({ text: t, image: button ? null : photo });
    if (!button) setPhoto(null);
    try {
      const r = await api('/test-chat', { method: 'POST', body: button ? { text: t, payload: button.payload } : { text: t, image: photo } });
      setQuick(r.reply?.quick || []);
    } catch (err) {
      toast(err.message, true);
    }
    await load();
    setPending(null);
  }

  async function reset() {
    await api('/test-chat', { method: 'POST', body: { reset: true } });
    setMsgs([]);
    setQuick([]);
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
          <div className="empty">
            কাস্টমার হিসেবে মেসেজ পাঠিয়ে দেখুন AI কীভাবে উত্তর দেয়।<br />যেমন: &quot;serum er dam koto?&quot;
            <br />📷 বাটন দিয়ে কোনো প্রোডাক্টের স্ক্রিনশট দিয়েও দেখতে পারেন।
          </div>
        )}
        {msgs.map((m) => <Bubble key={m.id} m={m} />)}
        {pending && (
          <>
            <Bubble m={{ direction: 'in', text: pending.text, image_url: pending.image }} />
            <div className="typing">{pending.image ? 'AI ছবি দেখছে...' : 'AI লিখছে...'}</div>
          </>
        )}
        {!pending && quick.length > 0 && (
          <div className="quick-replies">
            {quick.map((q) => <button key={q.payload} type="button" onClick={() => send(null, q)}>{q.title}</button>)}
          </div>
        )}
      </div>
      {photo && (
        <div className="attach-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" />
          <span>ছবি যুক্ত হয়েছে</span>
          <button className="btn sm" onClick={() => setPhoto(null)}>✕</button>
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <input type="file" accept="image/*" ref={fileRef} onChange={pick} hidden />
        <button type="button" className="btn attach" onClick={() => fileRef.current?.click()} title="ছবি / স্ক্রিনশট দিন">📷</button>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={photo ? 'ছবির সাথে কিছু লিখুন (ঐচ্ছিক)...' : 'কাস্টমার হিসেবে কিছু লিখুন...'} />
        <button className="send" disabled={!!pending}><Icon name="send" /></button>
      </form>
    </div>
  );
}
