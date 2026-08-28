import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTO-SELF',
  description: 'Independent poker training, replay and strategy review.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-900 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
