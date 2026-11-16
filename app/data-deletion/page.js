import LegalLayout from '@/components/LegalLayout';
import { getPlatform } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Data Deletion Instructions' };

export default async function DataDeletion() {
  const p = (await getPlatform());
  return (
    <LegalLayout
      title="Data Deletion Instructions"
      updated="November 2026"
      summary="আপনার ডাটা মুছতে চাইলে নিচের ধাপগুলো অনুসরণ করুন অথবা আমাদের ইমেইল করুন — ৭ দিনের মধ্যে মুছে ফেলা হবে।"
    >
      <h2>If you are a business using {p.brand_name}</h2>
      <ol>
        <li>Log in to your dashboard and open <b>Facebook Pages</b>. Click <b>Disconnect</b> on a Page to stop the service and delete that Page&apos;s access token.</li>
        <li>To delete your whole account — Pages, conversations, products, orders and settings — email us from your account&apos;s email address with the subject <b>&quot;Delete my account&quot;</b>.</li>
        <li>You can also remove our app from Facebook: <b>Facebook Settings → Business Integrations</b>, select {p.brand_name} and click <b>Remove</b>.</li>
      </ol>

      <h2>If you messaged a business Page that uses {p.brand_name}</h2>
      <p>
        Send us an email with the name of the Page you messaged and your Facebook name, and ask for your conversation to be
        deleted. We will delete your messages and profile details from our system.
      </p>

      <h2>How long it takes</h2>
      <p>Requests are completed within 7 days. Deleted data cannot be recovered.</p>

      {p.support_email && (
        <p>
          <a className="btn primary" href={`mailto:${p.support_email}?subject=Delete%20my%20data`}>Email a deletion request</a>
        </p>
      )}
    </LegalLayout>
  );
}
