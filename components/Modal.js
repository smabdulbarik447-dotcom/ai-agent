'use client';

import { toast } from '@/lib/client';

// Form dialog: collects named fields (checkboxes as booleans) and passes them to onSubmit
export default function Modal({ title, children, onSubmit, onClose, submitLabel = 'সেভ করুন' }) {
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    e.target.querySelectorAll('input[type=checkbox]').forEach((c) => (data[c.name] = c.checked));
    try {
      await onSubmit(data);
      onClose();
    } catch (err) {
      toast(err.message, true);
    }
  }
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h3>{title}</h3>
        {children}
        <div className="foot">
          <button type="button" className="btn" onClick={onClose}>বাতিল</button>
          <button className="btn primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
