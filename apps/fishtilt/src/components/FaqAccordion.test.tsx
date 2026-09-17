import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { FAQ } from './FAQ.js';
import { FaqAccordion } from './FaqAccordion.js';

const ITEMS = [
  { question: '이 표는 정답인가요?', answer: '아니요. 학습용 기본 레인지입니다.' },
  { question: '숫자는 어디서 나오나요?', answer: '그 자리에서 계산합니다.', link: { href: '/learn', label: '배우기 열기' } },
];

function faqBlock(container: HTMLElement): { readonly mainEntity: readonly { name: string }[] } | null {
  const script = container.querySelector('script[type="application/ld+json"]');
  return script === null ? null : JSON.parse(script.textContent ?? 'null');
}

describe('FaqAccordion (D-S3-12)', () => {
  it('puts every answer behind a native <details>, closed, with the question as the summary', () => {
    const { container } = renderBothThemes(<FaqAccordion items={ITEMS} />);
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(2);
    for (const [index, item] of ITEMS.entries()) {
      const d = details[index] as HTMLDetailsElement;
      expect(d.open).toBe(false);
      expect(within(d.querySelector('summary') as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(item.question);
      expect(within(d).getByText(item.answer)).toBeInTheDocument();
    }
    // No JavaScript: nothing here is a button and nothing manages aria-expanded.
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
  });

  it('publishes the same FAQPage block the open variant does — same questions, same order', () => {
    const { container } = renderBothThemes(<FaqAccordion items={ITEMS} />);
    const block = faqBlock(container);
    expect(block?.mainEntity.map((entry) => entry.name)).toEqual(ITEMS.map((item) => item.question));
  });

  it('keeps the follow-on link beside the answer, still a real link', () => {
    renderBothThemes(<FaqAccordion items={ITEMS} />);
    expect(screen.getByRole('link', { name: '배우기 열기' })).toHaveAttribute('href', '/learn');
  });

  it('the summary is a 44px control with a visible focus ring', () => {
    const { container } = renderBothThemes(<FaqAccordion items={ITEMS} />);
    const summary = container.querySelector('summary');
    expect(summary?.className).toContain('min-h-11');
    expect(summary?.className).toContain('focus-visible:outline-brand-500');
  });
});

describe('FAQ — the MDX name', () => {
  it('renders FaqSection, open by default, with the structured data', () => {
    const { container } = renderBothThemes(<FAQ items={ITEMS} title="궁금한 점" />);
    expect(screen.getByRole('region', { name: '궁금한 점' })).toBeInTheDocument();
    expect(container.querySelectorAll('details')).toHaveLength(0);
    expect(faqBlock(container)?.mainEntity).toHaveLength(2);
  });

  it('accepts the accordion variant too', () => {
    const { container } = renderBothThemes(<FAQ items={ITEMS} variant="accordion" />);
    expect(container.querySelectorAll('details')).toHaveLength(2);
  });
});
