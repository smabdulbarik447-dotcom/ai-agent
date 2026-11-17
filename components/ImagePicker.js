'use client';

import { useRef, useState } from 'react';
import { toast } from '@/lib/client';

const MAX_SIDE = 1200; // px — big enough for Messenger/WhatsApp, small enough to load fast

/** Shrink a photo in the browser and return it as a JPEG (or PNG if it has see-through parts) data URL */
async function shrink(file) {
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবি ফাইল দিন');
  if (file.type === 'image/gif' && file.size <= 1_500_000) return readAsDataUrl(file); // keep animation
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const png = file.type === 'image/png' && hasAlpha(bmp);
  if (!png) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
}

function hasAlpha(bmp) {
  const c = document.createElement('canvas');
  c.width = Math.min(64, bmp.width);
  c.height = Math.min(64, bmp.height);
  const x = c.getContext('2d');
  x.drawImage(bmp, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

const readAsDataUrl = (file) =>
  new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = fail;
    r.readAsDataURL(file);
  });

/**
 * Product photo field: upload from phone/computer, drag & drop, paste (Ctrl+V), or a link.
 * Sends its value through a hidden input named `name`.
 */
export default function ImagePicker({ name = 'image', defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue || '');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const fileRef = useRef(null);

  async function take(file) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await shrink(file);
      if (url.length > 2_600_000) throw new Error('ছবিটা অনেক বড়, অন্য একটা দিন');
      setValue(url);
      setShowLink(false);
    } catch (e) {
      toast(e.message || 'ছবি পড়া যায়নি', true);
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e) {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      take(file);
    }
  }

  const isUpload = value.startsWith('data:');

  return (
    <div className="field">
      <label>প্রোডাক্টের ছবি</label>
      <input type="hidden" name={name} value={value} />
      <div
        className={'img-pick' + (drag ? ' drag' : '') + (value ? ' has' : '')}
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
        onClick={() => !value && fileRef.current?.click()}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" onError={() => !isUpload && toast('এই লিংকে ছবি পাওয়া যাচ্ছে না', true)} />
        ) : (
          <div className="img-empty">
            <span className="img-ic">{busy ? '⏳' : '🖼️'}</span>
            <b>{busy ? 'ছবি তৈরি হচ্ছে...' : 'ছবি আপলোড করতে ক্লিক করুন'}</b>
            <small>অথবা এখানে টেনে আনুন / Ctrl+V দিয়ে পেস্ট করুন · JPG, PNG, WEBP</small>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <button type="button" className="btn sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          📷 {value ? 'ছবি বদলান' : 'ছবি আপলোড'}
        </button>
        <button type="button" className="btn sm" onClick={() => setShowLink((s) => !s)}>🔗 লিংক দিন</button>
        {value && <button type="button" className="btn sm danger" onClick={() => { setValue(''); setShowLink(false); }}>✕ সরান</button>}
        {isUpload && <span className="hint" style={{ margin: 0 }}>সেভ করলে আপলোড হবে</span>}
      </div>
      {showLink && (
        <input
          type="text" style={{ marginTop: 8 }} placeholder="https://.../photo.jpg" autoFocus
          defaultValue={isUpload ? '' : value}
          onChange={(e) => setValue(e.target.value.trim())}
        />
      )}
    </div>
  );
}
