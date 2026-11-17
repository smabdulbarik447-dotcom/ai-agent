'use client';

import { useEffect } from 'react';

// 3D tilt: cards lean towards the mouse and a soft light follows the cursor.
// One listener for the whole app (works for cards added later too). Skipped on
// touch screens and for people who turned on "reduce motion".
const TILT = '.card, .plan, .feature, .lp-demo, .learn-stat, .pay-acc, .side-card';
const MAX = 7; // degrees

export default function Depth3D() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let current = null;
    let frame = 0;

    const reset = (el) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.classList.remove('tilting');
    };

    function move(e) {
      const el = e.target.closest?.('.modal-bg, .toast') ? null : e.target.closest?.(TILT);
      if (current && current !== el) reset(current);
      current = el;
      if (!el || el.closest('.modal, .inbox') || el.offsetHeight > 560) return; // big panels stay flat
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--rx', `${((0.5 - y) * MAX).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * MAX).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    }
    const leave = () => current && reset(current);

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div className="scene3d" aria-hidden="true">
      <div className="floor3d" />
      <i className="orb o1" />
      <i className="orb o2" />
      <i className="orb o3" />
      <div className="cube3d c1"><b /><b /><b /><b /><b /><b /></div>
      <div className="cube3d c2"><b /><b /><b /><b /><b /><b /></div>
      <div className="ring3d" />
    </div>
  );
}
