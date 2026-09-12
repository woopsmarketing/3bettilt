import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MIN_FAQ_ITEMS } from '../lib/seo/index.js';
import { FaqSection, type FaqEntry } from './FaqSection.js';

/*
 * Tested against FIXTURES THIS FILE CONSTRUCTS, never against the homepage's own questions
 * (`docs/FISHTILT_STATE.md` ruling 26): this component is about to be reused on the four tool
 * pages WP-1 §7 names, so what has to stay provable is the CONTRACT — every question and
 * every answer in `items` is on screen, in order, as real headings and real prose — not
 * whichever six questions the front page happens to ask today.
 *
 * That contract is also the thing the `FAQPage` block depends on. WP-7a moved that block INTO
 * this component — one array, both renderings, the way `Breadcrumbs` works — so the last group
 * of tests below asserts the two against each other rather than trusting them to agree.
 */

const ITEMS: readonly FaqEntry[] = [
  { question: '무료인가요?', answer: '네, 전부 무료입니다.' },
  {
    question: '어디서부터 시작하나요?',
    answer: '첫 편부터 순서대로 읽으면 됩니다.',
    link: { href: '/learn', label: '배우기 열기' },
  },
  {
    question: '숫자는 어디서 나오나요?',
    answer: '그 자리에서 계산합니다.',
    link: { href: null, label: '아직 없는 페이지' },
  },
];

describe('FaqSection', () => {
  it('renders every question as a heading and every answer as visible prose', () => {
    render(<FaqSection items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole('heading', { level: 3, name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });

  it('keeps the questions in the order the caller gave them', () => {
    render(<FaqSection items={ITEMS} />);
    const asked = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(asked).toEqual(ITEMS.map((item) => item.question));
  });

  it('hides no answer behind a control — nothing here is collapsed or toggled', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    expect(container.querySelectorAll('details')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(container.querySelectorAll('[hidden]')).toHaveLength(0);
  });

  it('is a labelled region, so the section can be found by name', () => {
    render(<FaqSection items={ITEMS} title="자주 묻는 질문" description="설명" />);
    const region = screen.getByRole('region', { name: '자주 묻는 질문' });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('자주 묻는 질문');
    expect(within(region).getByText('설명')).toBeInTheDocument();
  });

  it('renders a follow-on link when the destination resolved', () => {
    render(<FaqSection items={ITEMS} />);
    expect(screen.getByRole('link', { name: '배우기 열기' })).toHaveAttribute('href', '/learn');
  });

  it('renders no link at all when the destination is null', () => {
    render(<FaqSection items={ITEMS} />);
    expect(screen.queryByRole('link', { name: '아직 없는 페이지' })).not.toBeInTheDocument();
    // …and the answer it belonged to is still there. An unresolved link removes the link,
    // never the answer.
    expect(screen.getByText('그 자리에서 계산합니다.')).toBeInTheDocument();
  });

  it('keeps the link out of the answer text, because the answer is the structured-data string', () => {
    render(<FaqSection items={ITEMS} />);
    const answer = screen.getByText('첫 편부터 순서대로 읽으면 됩니다.');
    expect(answer.querySelector('a')).toBeNull();
  });

  it('renders nothing rather than an empty heading when there are no items', () => {
    const { container } = render(<FaqSection items={[]} title="자주 묻는 질문" />);
    expect(container.innerHTML).toBe('');
  });
});

/*
 * WP-7a. The `FAQPage` block is a serialisation of the very list rendered above it, so these
 * read it back out of the DOM and compare it to what a reader can see — never to `ITEMS`
 * directly, which would only prove the component agrees with itself.
 */
function faqBlock(container: HTMLElement): Record<string, unknown> | null {
  const script = container.querySelector('script[type="application/ld+json"]');
  return script === null ? null : (JSON.parse(script.textContent ?? '') as Record<string, unknown>);
}

interface QuestionBlock {
  readonly name: string;
  readonly acceptedAnswer: { readonly text: string };
}

describe('FaqSection structured data', () => {
  it('publishes exactly the questions and answers on screen, in the order shown', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    const block = faqBlock(container);
    expect(block?.['@type']).toBe('FAQPage');

    const entries = block?.['mainEntity'] as readonly QuestionBlock[];
    const shownQuestions = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent ?? '');

    expect(entries.map((entry) => entry.name)).toEqual(shownQuestions);
    for (const entry of entries) {
      // The published answer is the exact text of a paragraph a reader can read. `getByText`
      // throws if no element has precisely that text, which is the assertion.
      expect(screen.getByText(entry.acceptedAnswer.text)).toBeInTheDocument();
    }
  });

  it('leaves the follow-on link out of the published answer, as it is out of the visible one', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    const entries = faqBlock(container)?.['mainEntity'] as readonly QuestionBlock[];
    for (const entry of entries) {
      expect(entry.acceptedAnswer.text).not.toContain('배우기 열기');
      expect(entry.acceptedAnswer.text).not.toContain('/learn');
    }
  });

  it('publishes an item whose link did not resolve — the ANSWER is still on screen', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    const entries = faqBlock(container)?.['mainEntity'] as readonly QuestionBlock[];
    expect(entries.map((entry) => entry.name)).toContain('숫자는 어디서 나오나요?');
  });

  it('publishes nothing for a block below the site`s own FAQ minimum', () => {
    const { container } = render(<FaqSection items={ITEMS.slice(0, MIN_FAQ_ITEMS - 1)} />);
    // The single question is still RENDERED — the reader asked for it — and simply not
    // published, which is the same rule `src/lib/seo/faq.ts` applies to the MDX pipeline.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(MIN_FAQ_ITEMS - 1);
    expect(faqBlock(container)).toBeNull();
  });

  it('publishes nothing at all when there is nothing to render', () => {
    const { container } = render(<FaqSection items={[]} />);
    expect(faqBlock(container)).toBeNull();
  });

  it('claims no date, rating or review', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    const serialised = JSON.stringify(faqBlock(container));
    expect(serialised).not.toContain('datePublished');
    expect(serialised).not.toContain('aggregateRating');
    expect(serialised).not.toContain('"review"');
  });
});

describe('FaqSection — variant="accordion" (WP-S3-03)', () => {
  it('keeps the open variant as the default, so every existing page still shows every answer', () => {
    const { container } = render(<FaqSection items={ITEMS} />);
    expect(container.querySelector('section')?.getAttribute('data-variant')).toBe('open');
    expect(container.querySelectorAll('details')).toHaveLength(0);
  });

  it('publishes the identical FAQPage block in both variants — one array, one data path', () => {
    const open = render(<FaqSection items={ITEMS} />);
    const openBlock = open.container.querySelector('script[type="application/ld+json"]')?.textContent;
    open.unmount();
    const accordion = render(<FaqSection items={ITEMS} variant="accordion" />);
    const accordionBlock = accordion.container.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(accordionBlock).toBe(openBlock);
    expect(accordion.container.querySelectorAll('details')).toHaveLength(ITEMS.length);
  });
});
