import Icon from './Icon';

const limit = (n, unit) => (!n || n <= 0 ? `আনলিমিটেড ${unit}` : `${Number(n).toLocaleString('en-IN')}টি ${unit}`);

// Pricing card used on the landing page and the billing page
export default function PlanCard({ plan, featured, current, ribbon, children }) {
  const items = [
    [true, limit(plan.max_pages, 'Facebook পেজ')],
    [true, `মাসে ${limit(plan.ai_replies, 'AI রিপ্লাই')}`],
    [true, limit(plan.max_products, 'প্রোডাক্ট')],
    [true, limit(plan.max_rules, 'অটো রিপ্লাই রুল')],
    [!!plan.website_sync, 'ওয়েবসাইট থেকে অটো প্রোডাক্ট সিঙ্ক'],
    [!!plan.ai_orders, 'AI নিজে অর্ডার নেবে'],
    ...String(plan.features || '').split('\n').filter(Boolean).map((f) => [true, f]),
  ];
  return (
    <div className={'plan' + (current ? ' current' : featured ? ' featured' : '')}>
      {(ribbon || current) && <div className="ribbon">{current ? 'আপনার প্ল্যান' : ribbon}</div>}
      <h3>{plan.name}</h3>
      <div className="price">
        ৳{Number(plan.price).toLocaleString('en-IN')} <small>/ {plan.period_days} দিন</small>
      </div>
      <ul>
        {items.map(([yes, text], i) => (
          <li key={i} className={yes ? '' : 'no'}><Icon name="check" />{text}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}
