import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/nunito';
import '@fontsource-variable/rubik';
import './globals.css';

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
