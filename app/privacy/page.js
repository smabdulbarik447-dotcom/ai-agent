import LegalLayout from '@/components/LegalLayout';
import { getPlatform } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Privacy Policy' };

export default async function Privacy() {
  const name = (await getPlatform()).brand_name;
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="November 2026"
      summary="সংক্ষেপে: আমরা শুধু বট চালানোর জন্য দরকারি তথ্য রাখি, কারো কাছে বিক্রি করি না, এবং আপনি চাইলে যেকোনো সময় সব ডাটা মুছে ফেলা যায়।"
    >
      <p>
        {name} (&quot;we&quot;, &quot;us&quot;) provides an automated customer-reply service for Facebook Pages. Business owners
        (&quot;Customers&quot;) connect their Facebook Page so our software can answer messages that people
        (&quot;End Users&quot;) send to that Page on Messenger. This policy explains what data we handle and why.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><b>Account information</b> from Customers: name, email address, phone number, business name and a hashed password.</li>
        <li><b>Facebook Page data</b> granted through Facebook Login: the Page ID, Page name and a Page access token, used only to receive and send messages for that Page, and the Page&apos;s own published posts (text and photos), which we read to learn the products and offers the business sells.</li>
        <li><b>Photos sent in Messenger</b>: when an End User sends a picture or screenshot, it is analysed to find the matching product.</li>
        <li><b>Messenger conversations</b>: messages End Users send to a connected Page, the replies sent, and the End User&apos;s public profile name and picture as provided by Facebook.</li>
        <li><b>Order details</b> that End Users choose to share in chat, such as name, phone number and delivery address.</li>
        <li><b>Product information</b> that Customers add or that we read from the Customer&apos;s own website on their instruction.</li>
        <li><b>Payment records</b>: plan purchased, amount, payment method, sender number and transaction ID. We do not collect card details.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To generate and send replies to End Users on behalf of the Customer&apos;s Page.</li>
        <li>To show the Customer their inbox, customers, orders and statistics in the dashboard.</li>
        <li>To verify payments and manage subscriptions.</li>
        <li>To keep the service secure and prevent abuse.</li>
      </ul>
      <p>We do not sell personal data and do not use Messenger conversations for advertising.</p>

      <h2>3. Sharing with service providers</h2>
      <p>
        To write replies, the text of a conversation and the Customer&apos;s product information are sent to our AI provider
        (Anthropic, maker of Claude), which processes it to produce a reply and does not use it to train its models under our
        commercial terms. Messages are sent and received through Meta&apos;s Messenger Platform. We share data with no one else
        except when required by law.
      </p>

      <h2>4. Data retention</h2>
      <p>
        Data is kept while the Customer&apos;s account is active. When a Customer disconnects a Page, we stop receiving its
        messages and delete its access token. When an account is deleted, all of its Pages, conversations, products and orders
        are permanently deleted.
      </p>

      <h2>5. Your rights and data deletion</h2>
      <p>
        Customers can delete their data at any time from the dashboard or by contacting us. End Users who messaged a Page can
        ask for their conversation to be deleted — see our <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>6. Security</h2>
      <p>Passwords are stored hashed, access to dashboards requires login, and all traffic uses HTTPS.</p>

      <h2>7. Changes</h2>
      <p>We may update this policy. Significant changes will be shown on this page with a new date.</p>
    </LegalLayout>
  );
}
