'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { PageHead } from '@/components/Shell';
import { Bubble } from '@/components/TestChat';
import { api, initials, toast, when } from '@/lib/client';

function Avatar({ c }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <div className="avatar">{c.profile_pic ? <img src={c.profile_pic} alt="" /> : initials(c.name)}</div>
  );
}

function Inbox() {
  const params = useSearchParams();
  const [active, setActive] = useState(Number(params.get('c')) || null);
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const box = useRef(null);
  const lastSig = useRef('');

  const loadList = useCallback(() => api('/conversations?q=' + encodeURIComponent(q)).then(setList).catch(() => {}), [q]);
  const loadThread = useCallback(async () => {
    if (!active) return;
    const t = await api(`/conversations/${active}/messages`).catch(() => null);
    if (!t) return;
    const sig = `${active}:${t.messages.length}:${t.messages.at(-1)?.id}:${t.customer?.bot_paused}`;
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setThread(t);
    }
  }, [active]);

  useEffect(() => {
    const t = setTimeout(loadList, 250);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => { loadThread(); }, [loadThread]);

  // New messages arrive from Facebook in the background - poll
  useEffect(() => {
    const t = setInterval(() => { loadList(); loadThread(); }, 4000);
    return () => clearInterval(t);
  }, [loadList, loadThread]);

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [thread]);

  function open(id) {
    setActive(id);
    window.history.replaceState(null, '', '/dashboard/inbox?c=' + id);
  }

  async function toggleBot(on) {
    await api(`/conversations/${active}/bot`, { method: 'POST', body: { paused: !on } });
    loadThread();
    loadList();
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      await api(`/conversations/${active}/reply`, { method: 'POST', body: { text: t } });
      setText('');
      loadThread();
      loadList();
    } catch (err) {
      toast(err.message, true);
    }
  }

  const c = thread?.customer;

  return (
    <>
      <PageHead title="Inbox" sub="সব Messenger কথোপকথন — দরকার হলে নিজে উত্তর দিন" />
      <div className="inbox">
        <div className="card">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম বা ফোন দিয়ে খুঁজুন..." style={{ marginBottom: 10 }} />
          <div className="conv-list">
            {!list.length && <div className="empty">কোনো কথোপকথন নেই</div>}
            {list.map((x) => (
              <div key={x.id} className={'conv' + (x.id === active ? ' active' : '')} onClick={() => open(x.id)}>
                <Avatar c={x} />
                <div className="t"><b>{x.name || 'Facebook User'}</b><span>{x.last_text}</span></div>
                <div className="time">
                  {when(x.last_message_at)}<br />
                  {x.unread > 0 && x.id !== active ? <span className="badge">{x.unread}</span> : x.bot_paused ? <span className="pill off" style={{ fontSize: 10 }}>bot off</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          {!c ? (
            <div className="empty">বাম পাশ থেকে একটি কথোপকথন বেছে নিন</div>
          ) : (
            <div className="chat">
              <div className="chat-head">
                <Avatar c={c} />
                <div style={{ flex: 1 }}>
                  <b>{c.name || 'Facebook User'}</b>
                  <div className="hint" style={{ margin: 0 }}>{c.phone} {c.address}</div>
                </div>
                <span className="hint" style={{ margin: 0 }}>AI বট</span>
                <label className="switch"><input type="checkbox" checked={!c.bot_paused} onChange={(e) => toggleBot(e.target.checked)} /><span /></label>
              </div>
              {c.bot_paused ? (
                <div className="notice" style={{ margin: '10px 0 0' }}>এই কাস্টমারের জন্য বট বন্ধ আছে — আপনি নিজে উত্তর দিচ্ছেন। আবার চালু করতে উপরের সুইচ অন করুন।</div>
              ) : null}
              <div className="msgs" ref={box}>
                {thread.messages.map((m) => <Bubble key={m.id} m={m} />)}
              </div>
              <form className="composer" onSubmit={send}>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="নিজে উত্তর লিখুন (পাঠালে এই কাস্টমারের বট বন্ধ হবে)..." />
                <button className="send"><Icon name="send" /></button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
