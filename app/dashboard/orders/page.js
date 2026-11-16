'use client';

import { useEffect, useState } from 'react';
import { PageHead, useMe } from '@/components/Shell';
import OrdersTable from '@/components/OrdersTable';
import { api, STATUS } from '@/lib/client';

export default function OrdersPage() {
  const { me } = useMe();
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState(null);

  useEffect(() => { api('/orders?status=' + status).then(setOrders); }, [status]);

  const sub = me?.subscription;

  return (
    <>
      <PageHead title="Orders" sub="AI এজেন্ট Messenger থেকে যে অর্ডার নিয়েছে">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">সব অর্ডার</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageHead>
      {sub && !sub.ai_orders && (
        <div className="notice">আপনার {sub.plan_name} প্ল্যানে AI নিজে অর্ডার তৈরি করে না — শুধু কাস্টমারের তথ্য নেয়। AI দিয়ে অর্ডার নিতে Business বা Pro প্ল্যানে আপগ্রেড করুন।</div>
      )}
      <div className="card">{orders && <OrdersTable key={status} orders={orders} />}</div>
    </>
  );
}
