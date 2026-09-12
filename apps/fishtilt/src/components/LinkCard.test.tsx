import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinkCard } from './LinkCard.js';

/*
 * The card is the site's single rule-holder for "may this be a link", so its two states are
 * tested against FIXTURES THIS FILE CONSTRUCTS, never against whatever the product happens not
 * to have built today (`docs/FISHTILT_STATE.md` ruling 26). The unresolved case has to stay
 * provable after every route and every record has shipped.
 */
describe('LinkCard', () => {
  it('is a real link when the destination resolved, and carries the whole card', () => {
    render(
      <ul>
        <LinkCard href="/learn/example" title="제목" description="설명" meta="초급 · 약 3분" />
      </ul>,
    );
    const link = screen.getByRole('link', { name: /제목/u });
    expect(link).toHaveAttribute('href', '/learn/example');
    expect(link).toHaveTextContent('설명');
    expect(link).toHaveTextContent('초급 · 약 3분');
  });

  it('renders an <li>, because every caller is a list of destinations', () => {
    const { container } = render(
      <ul>
        <LinkCard href="/tools" title="제목" />
      </ul>,
    );
    expect(container.querySelector('ul > li')).toBeInTheDocument();
  });

  it('renders no link and no button at all when the destination is null', () => {
    render(
      <ul>
        <LinkCard href={null} title="아직 없는 것" description="설명" />
      </ul>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says 준비 중 in words for an unresolved destination, and keeps the name readable', () => {
    render(
      <ul>
        <LinkCard href={null} title="아직 없는 것" />
      </ul>,
    );
    expect(screen.getByText('준비 중')).toBeInTheDocument();
    expect(screen.getByText('아직 없는 것')).toBeInTheDocument();
  });

  it('omits the optional lines rather than rendering empty ones', () => {
    const { container } = render(
      <ul>
        <LinkCard href="/tools" title="제목만" />
      </ul>,
    );
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('shows the eyebrow above the title when one is given', () => {
    render(
      <ul>
        <LinkCard href="/learn/x" eyebrow="01" title="첫 강의" />
      </ul>,
    );
    const eyebrow = screen.getByText('01');
    const title = screen.getByText('첫 강의');
    expect(eyebrow).toBeInTheDocument();
    // Reading order, not just presence: the number introduces the lesson, it does not follow it.
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the visual slot only when something is passed, with no reserved box otherwise', () => {
    /*
     * WP-5 fills this slot with `ContentThumbnail` on `/blog`. The four hubs that pass no
     * visual must look exactly as they did before the slot existed — an empty placeholder box
     * on `/glossary`'s 58 cards and `/hands`' 20 would be a worse regression than having no
     * thumbnails at all.
     */
    const { container, rerender } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" />
      </ul>,
    );
    expect(container.querySelectorAll('span')).toHaveLength(1);

    rerender(
      <ul>
        <LinkCard href="/blog/x" title="제목" visual={<i data-testid="thumb" />} />
      </ul>,
    );
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
  });

  it('shows category chips above the title, and none at all when none are given', () => {
    const { container, rerender } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" />
      </ul>,
    );
    // The four hubs that pass no chips must be byte-identical to their pre-WP-5 render.
    expect(container.querySelectorAll('span')).toHaveLength(1);

    rerender(
      <ul>
        <LinkCard href="/blog/x" title="제목" chips={['핸드레인지']} meta="초급 · 약 3분" />
      </ul>,
    );
    const chip = screen.getByText('핸드레인지');
    const title = screen.getByText('제목');
    expect(chip).toBeInTheDocument();
    // Reading order: the category introduces the article, it does not trail it.
    expect(chip.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a chip as a label, never as a nested link', () => {
    /*
     * The whole card is one `<a>`. An anchor inside an anchor is invalid HTML and browsers
     * resolve it by silently restructuring the DOM, so a "clickable category" here would be a
     * bug that only shows up in a real browser. WP-4 hit the same constraint from the other
     * side; this asserts it stays true.
     */
    const { container } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" chips={['족보', '확률과 오즈']} />
      </ul>,
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
    for (const label of ['족보', '확률과 오즈']) {
      expect(screen.getByText(label).tagName).toBe('SPAN');
    }
    // And the chips are inside the card's link, so the whole card stays one target.
    expect(container.querySelector('a')).toHaveTextContent('족보');
  });

  it('keeps chips and the visual on the unavailable card too', () => {
    // A 준비 중 card must look like a card (see the surface test below); that includes its
    // category, or the two states would be different objects at a glance.
    render(
      <ul>
        <LinkCard
          href={null}
          title="아직 없는 것"
          chips={['규칙']}
          visual={<i data-testid="thumb" />}
        />
      </ul>,
    );
    expect(screen.getByText('규칙')).toBeInTheDocument();
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('has a denser padding for the two-up index hubs than for the reading hubs', () => {
    const { container: roomy } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" />
      </ul>,
    );
    const { container: tight } = render(
      <ul>
        <LinkCard href="/glossary/x" title="제목" density="compact" />
      </ul>,
    );
    expect(roomy.querySelector('a')?.className).toContain('p-5');
    expect(tight.querySelector('a')?.className).toContain('p-4');
  });

  it('the linked and the unavailable card share one surface definition', () => {
    // They used to be two hand-written class strings per hub, six hubs over. The one thing a
    // reader must be able to rely on is that a "준비 중" card looks like a card.
    const { container: linked } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" />
      </ul>,
    );
    const { container: inert } = render(
      <ul>
        <LinkCard href={null} title="제목" />
      </ul>,
    );
    for (const cls of ['rounded-lg', 'border-line-500', 'bg-panel-700']) {
      expect(linked.querySelector('a')?.className).toContain(cls);
      expect(inert.querySelector('li')?.className).toContain(cls);
    }
  });

  it('shows hover and focus affordances on the link', () => {
    const { container } = render(
      <ul>
        <LinkCard href="/blog/x" title="제목" />
      </ul>,
    );
    const className = container.querySelector('a')?.className ?? '';
    expect(className).toContain('hover:border-brand-500');
    expect(className).toContain('hover:bg-panel-600');
    expect(className).toContain('focus-visible:outline');
  });

  it('is the only card component in the codebase', () => {
    /*
     * This replaces WP-2's `expect(HomeLinkCard).toBe(LinkCard)`. That assertion existed
     * because `HomeLinkCard` was a temporary alias kept alive purely so `src/app/page.tsx`
     * could keep importing the old name while it belonged to another work package; WP-3
     * rebuilt the homepage on `LinkCard` and deleted the alias, so the aliasing check has
     * nothing left to compare.
     *
     * The PROPERTY it protected is the one that mattered — seven surfaces once re-implemented
     * this card, and the whole point of extracting it was that they can never fork again — so
     * it is asserted directly instead: no second card component file, and nothing importing
     * one. Stated over the filesystem rather than over an import, because the failure mode is
     * somebody ADDING a file, which an import-based test could not see.
     */
    const dir = dirname(fileURLToPath(import.meta.url));
    const cardFiles = readdirSync(dir).filter(
      (name) => /LinkCard\.tsx$/u.test(name) && !/\.test\.tsx$/u.test(name),
    );
    expect(cardFiles).toEqual(['LinkCard.tsx']);

    const offenders: string[] = [];
    const walk = (current: string): void => {
      for (const item of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, item.name);
        if (item.isDirectory()) walk(full);
        else if (/\.tsx?$/u.test(item.name) && !/\.test\.tsx?$/u.test(item.name)) {
          if (/HomeLinkCard/u.test(readFileSync(full, 'utf8'))) offenders.push(full);
        }
      }
    };
    walk(join(dir, '..'));
    expect(
      offenders,
      `HomeLinkCard was removed; these still reference it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
