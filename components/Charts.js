'use client';

import { useState } from 'react';
import { SOURCE, SOURCE_COLOR, shortDate } from '@/lib/client';

const W = 620, H = 230, L = 34, B = 24, T = 10;

const DEFAULT_SERIES = [
  { key: 'incoming', label: 'কাস্টমার মেসেজ', color: '#16a34a' },
  { key: 'auto', label: 'অটো রিপ্লাই', color: '#f97316' },
];

// Grouped bars per day (default: customer messages vs automatic replies)
export function BarChart({ days, series = DEFAULT_SERIES, format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(4, ...days.flatMap((d) => series.map((x) => d[x.key])));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const cw = (W - L) / days.length;
  const bw = Math.min(10, cw / 4);
  const y = (v) => T + (H - T - B) * (1 - v / top);

  // Rounded top, square base anchored to the baseline
  const bar = (x, v, color, dim) => {
    if (!v) return null;
    const r = Math.min(4, bw / 2, y(0) - y(v));
    return (
      <path className={'bar' + (dim ? ' dim' : '')} fill={color}
        d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z`} />
    );
  };

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <g className="grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={L} x2={W} y1={y(step * i)} y2={y(step * i)} />
              <text x={L - 8} y={y(step * i) + 3} textAnchor="end">{format(step * i)}</text>
            </g>
          ))}
        </g>
        {days.map((d, i) => {
          const cx = L + cw * i + cw / 2;
          const dim = hover != null && hover !== i;
          return (
            <g key={d.day}>
              {series.map((x, j) => (
                <g key={x.key}>{bar(series.length === 1 ? cx - bw / 2 : j === 0 ? cx - bw - 1 : cx + 1, d[x.key], x.color, dim)}</g>
              ))}
              {i % 2 === 1 && <text x={cx} y={H - 6} textAnchor="middle">{shortDate(d.day)}</text>}
              <rect x={L + cw * i} y={T} width={cw} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: `${((L + cw * hover + cw / 2) / W) * 100}%`, top: 30 }}>
          <b>{shortDate(days[hover].day)}</b><br />
          {series.map((x) => (
            <div key={x.key}><i style={{ background: x.color }} />{x.label}: {format(days[hover][x.key])}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Share of replies by who answered
export function Donut({ sources }) {
  const total = sources.reduce((a, s) => a + s.c, 0);
  const R = 60, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 150 150">
        {total ? (
          sources.map((s) => {
            const len = (s.c / total) * C;
            const gap = sources.length > 1 ? 2 : 0;
            const el = (
              <circle key={s.source} r={R} cx="75" cy="75" fill="none" stroke={SOURCE_COLOR[s.source] || '#999'} strokeWidth="20"
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 75 75)">
                <title>{`${SOURCE[s.source] || s.source}: ${s.c}`}</title>
              </circle>
            );
            off += len;
            return el;
          })
        ) : (
          <circle r={R} cx="75" cy="75" fill="none" stroke="#eef1ef" strokeWidth="20" />
        )}
        <text x="75" y="73" textAnchor="middle" fontSize="22" fontWeight="800" fill="#16201b">{total}</text>
        <text x="75" y="91" textAnchor="middle" fontSize="10" fill="#8a958f">Replies</text>
      </svg>
      <div className="donut-legend">
        {total ? (
          sources.map((s) => (
            <div key={s.source}>
              <i style={{ background: SOURCE_COLOR[s.source] || '#999' }} />
              {SOURCE[s.source] || s.source}
              <b>{Math.round((s.c / total) * 100)}%</b>
            </div>
          ))
        ) : (
          <div>এখনো কোনো রিপ্লাই নেই</div>
        )}
      </div>
    </div>
  );
}
