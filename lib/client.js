'use client';

// Browser-side helpers shared by all panel pages

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const here = window.location.pathname;
    window.location.href = (here.startsWith('/admin') ? '/admin/login' : '/login') + '?next=' + encodeURIComponent(here);
    throw new Error('login required');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
  return data;
}

export function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export const money = (n) => (n == null ? '—' : '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
export const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export const shortDate = (day) => new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const limitText = (n) => (!n || n <= 0 ? 'আনলিমিটেড' : Number(n).toLocaleString('en-IN'));

const parse = (ts) => new Date(ts.replace(' ', 'T') + 'Z');

export function when(ts) {
  if (!ts) return '';
  const d = parse(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${shortDate(d)}, ${time}`;
}

export const dateOnly = (ts) => (ts ? parse(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const daysLeft = (ts) => (ts ? Math.max(0, Math.ceil((parse(ts) - Date.now()) / 86400000)) : 0);

export const STATUS = { new: 'নতুন', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'রিটার্ন' };
export const STOCK = { in_stock: 'স্টকে আছে', out_of_stock: 'স্টক নেই', unknown: 'অজানা' };
export const SOURCE = { rule: 'অটো রুল', ai: 'AI এজেন্ট', product: 'প্রোডাক্ট তথ্য', order: 'চ্যাট অর্ডার', followup: 'অটো ফলো-আপ', manual: 'প্যানেল থেকে', page: 'পেজ ইনবক্স', fallback: 'ডিফল্ট রিপ্লাই' };
export const SOURCE_COLOR = { ai: '#16a34a', rule: '#f97316', product: '#0d9488', order: '#db2777', followup: '#ca8a04', manual: '#7c3aed', page: '#3b82f6', fallback: '#9aa5a0' };
export const PAY_METHOD = { bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট' };
export const PAY_STATUS = { pending: 'যাচাই হচ্ছে', approved: 'অনুমোদিত', rejected: 'বাতিল' };
