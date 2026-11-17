import { Inter, Hind_Siliguri, Orbitron, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './depth3d.css';
import './admin-hud.css';
import Depth3D from '@/components/Depth3D';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const orbitron = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-hud', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });
const bn = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-bn', display: 'swap' });

export const metadata = {
  title: 'Shob Paabo AI — Dashboard',
  description: 'Facebook Page AI sales agent',
  icons: { icon: '/logo.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn" className={`${inter.variable} ${bn.variable} ${orbitron.variable} ${mono.variable}`}>
      <body>
        <Depth3D />
        {children}
      </body>
    </html>
  );
}
