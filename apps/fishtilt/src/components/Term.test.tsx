import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as GraphModule from '../content/graph.js';
import type { GlossaryRecord } from '../content/types.js';
import { glossaryById } from '../content/graph.js';
import { Term, popoverIdFor } from './Term.js';

/*
 * §32's requirement is behavioural — tap must work, hover-only is forbidden — and the way
 * this component meets it is structural: a real `<button>` wired to a native popover. So
 * that is what these tests pin. The open/close BEHAVIOUR belongs to the browser (and is
 * exercised in the browser, not in happy-dom, which does not implement the Popover API);
 * what can and must be checked here is that the wiring is correct and that no glossary text
 * leaks onto the page as a link that would 404.
 */

/**
 * A PLANNED glossary fixture this test owns outright, never sourced from the live registry.
 * All 58 real glossary terms have shipped, so hunting the registry for one still "not
 * written" — as this test used to — would go stale the day the last term published (ruling
 * 26; the same trap `routes.test.ts` documents for `available`, fixed the same way in
 * `graph.test.ts`, `ToolCTA.test.tsx`, `app/tools/page.test.tsx` and `hub.test.ts`). This
 * fixture stays `PLANNED` forever because the test constructs it, so the "no 자세히 보기 link
 * while unwritten" behaviour keeps being exercised for real no matter how much content ships.
 * `vi.hoisted` lets the mock factory below and the test body reference the same object.
 */
const { PLANNED_TERM } = vi.hoisted(() => {
  const fixture: GlossaryRecord = {
    kind: 'glossary',
    id: 'term-fixture-unwritten',
    slug: 'fixture-unwritten',
    title: '테스트 픽스처 용어 (Fixture)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 용어 픽스처.',
    level: 'BASIC',
    topic: 'range',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PLANNED',
    indexable: false,
    readMinutes: null,
    term: 'Fixture',
    aliases: [],
    shortDefinition: '테스트에서만 쓰는 짧은 정의.',
  };
  return { PLANNED_TERM: fixture };
});

vi.mock('../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  return {
    ...actual,
    glossaryById: (id: string) => (id === PLANNED_TERM.id ? PLANNED_TERM : actual.glossaryById(id)),
  };
});
describe('Term', () => {
  it('renders the trigger as a button — pressable by finger, mouse and keyboard alike', () => {
    render(<Term id="term-range">핸드레인지</Term>);
    const trigger = screen.getByRole('button', { name: /핸드레인지/u });
    expect(trigger).toHaveAttribute('type', 'button');
  });

  it('points the trigger at the popover it owns', () => {
    const { container } = render(<Term id="term-range">핸드레인지</Term>);
    const trigger = screen.getByRole('button', { name: /핸드레인지/u });
    const id = popoverIdFor('term-range');
    expect(trigger).toHaveAttribute('popovertarget', id);
    const panel = container.querySelector(`#${CSS.escape(id)}`);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('popover', 'auto');
  });

  it('carries the entry’s own one-line definition, not a restatement', () => {
    const entry = glossaryById('term-range');
    expect(entry).toBeDefined();
    render(<Term id="term-range">핸드레인지</Term>);
    expect(screen.getByText(entry?.shortDefinition ?? '')).toBeInTheDocument();
  });

  it('uses the word as written in the sentence, falling back to the term itself', () => {
    const { unmount } = render(<Term id="term-suited">같은 무늬</Term>);
    expect(screen.getByRole('button', { name: /같은 무늬/u })).toBeInTheDocument();
    unmount();
    render(<Term id="term-suited" />);
    expect(screen.getByRole('button', { name: /Suited/u })).toBeInTheDocument();
  });

  it('offers no "자세히 보기" link while the glossary entry is unwritten', () => {
    render(<Term id={PLANNED_TERM.id}>{PLANNED_TERM.term}</Term>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('gives a way to dismiss without a pointer that can hover', () => {
    render(<Term id="term-range">핸드레인지</Term>);
    const close = screen.getByRole('button', { name: '닫기' });
    expect(close).toHaveAttribute('popovertargetaction', 'hide');
  });

  it('throws for an id that is not a glossary entry', () => {
    expect(() => render(<Term id="poker-range">x</Term>)).toThrow(/not a glossary entry/u);
    expect(() => render(<Term id="nope">x</Term>)).toThrow(/not a glossary entry/u);
  });
});
