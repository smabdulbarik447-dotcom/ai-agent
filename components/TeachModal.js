'use client';

import Modal from './Modal';
import { api, toast } from '@/lib/client';

// Teach the AI one fact / Q&A (Training page and Inbox)
export default function TeachModal({ initial, onClose, onSaved }) {
  return (
    <Modal
      title={initial.id ? 'তথ্য এডিট' : 'AI কে শেখান'}
      submitLabel="শেখান"
      onClose={onClose}
      onSubmit={async (d) => {
        if (initial.id) await api('/knowledge/' + initial.id, { method: 'PUT', body: d });
        else await api('/knowledge', { method: 'POST', body: { ...d, source: initial.source } });
        toast('AI শিখে নিয়েছে ✓');
        onSaved?.();
      }}
    >
      <div className="field">
        <label>কাস্টমার কী জিজ্ঞেস করে / বিষয়</label>
        <input type="text" name="title" defaultValue={initial.title} required placeholder="যেমন: রিটার্ন করা যাবে?" />
      </div>
      <div className="field">
        <label>AI কী উত্তর দেবে</label>
        <textarea name="content" rows={5} defaultValue={initial.content} required placeholder="সঠিক উত্তরটি লিখুন — AI এটা নিজের ভাষায় কাস্টমারকে বলবে" />
        <div className="hint">হুবহু কপি নয় — AI এই তথ্য বুঝে কাস্টমারের প্রশ্ন অনুযায়ী উত্তর দেবে।</div>
      </div>
    </Modal>
  );
}
