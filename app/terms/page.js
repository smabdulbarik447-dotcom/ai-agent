import LegalLayout from '@/components/LegalLayout';
import { getPlatform } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Terms of Service' };

export default function Terms() {
  const name = getPlatform().brand_name;
  return (
    <LegalLayout
      title="Terms of Service"
      updated="November 2026"
      summary="সংক্ষেপে: প্ল্যানের টাকা দিয়ে নির্দিষ্ট দিনের জন্য সার্ভিস পাবেন। নিজের পেজে বট কী বলছে তার দায়িত্ব আপনার, এবং Facebook এর নিয়ম মেনে চলতে হবে।"
    >
      <h2>1. The service</h2>
      <p>
        {name} lets you connect your Facebook Page and automatically reply to customer messages using rules you create and an
        AI assistant that uses your product information.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must give accurate information and keep your password safe.</li>
        <li>You may only connect Facebook Pages you own or are authorised to manage.</li>
        <li>You are responsible for activity under your account.</li>
      </ul>

      <h2>3. Plans and payment</h2>
      <ul>
        <li>Paid plans run for the number of days shown on the plan. A plan starts once we verify your payment.</li>
        <li>Each plan has limits (pages, products, rules, AI replies per month). When the AI reply limit is reached, your rules and default reply keep working until the next month or an upgrade.</li>
        <li>Payments are non-refundable once a plan has been activated, unless the service was unavailable through our fault.</li>
        <li>We may change prices for future periods; your current period is not affected.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use the service to send spam, mislead or harass people, sell illegal goods, or break Meta&apos;s Platform Terms and Messenger policies. We may suspend accounts that do.</p>

      <h2>5. Your content and AI replies</h2>
      <p>
        You own your product data and conversations. AI replies are generated automatically and may sometimes be wrong; you are
        responsible for checking your product information and for what is sent from your Page. You can pause the bot for any
        conversation and reply yourself.
      </p>

      <h2>6. Availability</h2>
      <p>We aim to keep the service running at all times but cannot guarantee it will be uninterrupted. Facebook may change or limit its platform, which can affect the service.</p>

      <h2>7. Ending the service</h2>
      <p>You may stop using the service at any time and ask us to delete your account. We may suspend or close accounts that break these terms.</p>

      <h2>8. Liability</h2>
      <p>To the extent allowed by law, our total liability is limited to the amount you paid for the current plan period.</p>
    </LegalLayout>
  );
}
