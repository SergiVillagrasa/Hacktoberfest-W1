import type { Metadata, Viewport } from 'next';
import { Nunito, Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-rubik', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-nunito', display: 'swap' });

export const metadata: Metadata = {
  title: 'SnapHunt',
  description: 'A real-world photo scavenger hunt for 2-6 friends. Find each other\'s objects, hosted by a pug.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rubik.variable} ${nunito.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
