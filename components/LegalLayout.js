import Link from 'next/link';
import { getPlatform } from '@/lib/db';

// Shared frame for the public legal pages (privacy, terms, data deletion)
export default async function LegalLayout({ title, summary, updated, children }) {
  const p = (await getPlatform());
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" /> {p.brand_name}
        </Link>
        <nav className="row">
          <Link href="/login" className="btn">লগইন</Link>
          <Link href="/signup" className="btn primary">ফ্রি শুরু করুন</Link>
        </nav>
      </header>
      <article className="legal">
        <h1>{title}</h1>
        <p className="hint">Last updated: {updated}</p>
        {summary && <div className="notice ok">{summary}</div>}
        {children}
        <h2>Contact</h2>
        <p>
          {p.brand_name}
          {p.support_email && <> · Email: <a href={`mailto:${p.support_email}`}>{p.support_email}</a></>}
          {p.support_phone && <> · Phone: {p.support_phone}</>}
        </p>
      </article>
      <LegalFooter name={p.brand_name} />
    </div>
  );
}

export function LegalFooter({ name }) {
  return (
    <footer className="lp-foot">
      <span>© {new Date().getFullYear()} {name}</span>
      <span className="row" style={{ gap: 16 }}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/data-deletion">Data Deletion</Link>
      </span>
    </footer>
  );
}
