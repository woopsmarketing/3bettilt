import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTO-SELF',
  description: '6맥스 NLHE 독립 포커 트레이닝 · 핸드 리플레이 · 전략 리뷰 도구.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The primary user is Korean and the whole interface is Korean, so the document says
    // so: `lang` drives the browser's font selection, line breaking and hyphenation.
    <html lang="ko">
      <body className="min-h-screen bg-surface-900 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
