import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MDX_ALLOWED_COMPONENTS, useMDXComponents } from '../../mdx-components.js';
import { MDX_COMPONENT_ALLOW_LIST } from '../content/allowList.js';
import { measureContent } from '../content/threshold.js';
import { Figure } from './Figure.js';

describe('Figure', () => {
  it('associates the caption with the picture through <figure>/<figcaption>', () => {
    const { container } = render(
      <Figure caption="플랍에서 아직 보이지 않는 카드입니다.">
        <i data-testid="picture" />
      </Figure>,
    );
    const figure = container.querySelector('figure');
    expect(figure).toBeInTheDocument();
    expect(figure?.querySelector('figcaption')?.textContent).toBe(
      '플랍에서 아직 보이지 않는 카드입니다.',
    );
    expect(screen.getByTestId('picture')).toBeInTheDocument();
  });

  it('puts the caption after the picture, where a caption belongs', () => {
    const { container } = render(
      <Figure caption="설명">
        <i data-testid="picture" />
      </Figure>,
    );
    const picture = screen.getByTestId('picture');
    const caption = container.querySelector('figcaption');
    expect(caption).not.toBeNull();
    expect(
      picture.compareDocumentPosition(caption as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('draws no surface of its own, so a framed diagram is not boxed twice', () => {
    /*
     * `RangeMatrixMini` already renders the site's `ground-800` well. A frame here would put
     * that box inside a second identical box, which is why this component is markup and a
     * caption only and each diagram brings its own surface.
     */
    const { container } = render(
      <Figure caption="설명">
        <i />
      </Figure>,
    );
    const html = container.innerHTML;
    expect(html).not.toContain('bg-ground-800');
    expect(html).not.toContain('border-line-500');
  });

  it('writes the caption as a prop, so it never counts as body prose', () => {
    /*
     * `measureContent` keeps JSX CHILDREN and strips JSX ATTRIBUTES. That is the property this
     * component depends on: a caption must not help an article clear the 900-character
     * indexability floor, and adding a figure to a shipped article must not move its measured
     * `readMinutes` (which `content.test.ts` pins against the measurement). Asserted here
     * rather than assumed, because the whole in-body figure design rests on it.
     */
    const withoutFigure = '문단 하나.\n';
    const withFigure = `문단 하나.\n\n<Figure caption="이 문장은 캡션이라 본문 길이에 들어가지 않습니다">\n  <OutsFigure outs={9} street="FLOP" />\n</Figure>\n`;
    expect(measureContent(withFigure).proseCharacters).toBe(
      measureContent(withoutFigure).proseCharacters,
    );
    expect(measureContent(withFigure).componentUses).toContain('Figure');
  });

  it('the MDX allow-list and the components actually injected are the same set', () => {
    /*
     * `mdx-components.tsx`' header claims `content.test.ts` asserts this. It does not — that
     * file checks MDX prose against `MDX_COMPONENT_ALLOW_LIST` only, so the list and the map
     * `useMDXComponents` actually returns were never compared to each other. The gap is the
     * kind that stays invisible until it bites in both directions:
     *
     * - a name ON the list but NOT in the map passes every test and renders nothing, because
     *   MDX resolves an unknown capitalised tag to an undefined component;
     * - a component IN the map but NOT on the list is a rendering capability that the prose
     *   check cannot see, which is exactly the "any article may call anything" architecture
     *   problem the allow-list exists to prevent.
     *
     * WP-5 added three entries to that list, so it closes the gap it just widened. Asserted
     * here rather than in `src/content/`, which is outside this work package's boundary, and
     * from the real modules rather than from a copy.
     */
    const listed = [...MDX_COMPONENT_ALLOW_LIST].toSorted();
    const injected = Object.keys(MDX_ALLOWED_COMPONENTS).toSorted();
    expect(injected).toEqual(listed);

    // And what `useMDXComponents` hands MDX is that map, not a superset assembled elsewhere.
    const provided = useMDXComponents();
    for (const name of listed) {
      expect(provided[name], name).toBe(
        MDX_ALLOWED_COMPONENTS[name as keyof typeof MDX_ALLOWED_COMPONENTS],
      );
    }
    // The incoming argument is ignored on purpose: an override would make the set negotiable
    // per render, and the point of the list is that it is not.
    const hijacked = useMDXComponents({ Evil: () => null } as never);
    expect(hijacked['Evil']).toBeUndefined();
  });

  it('is registered under the name prose calls it by, from this very file', () => {
    // Proves the component this file exports is the one that got wired, so a rename cannot
    // leave prose calling a name that resolves to nothing.
    expect(MDX_ALLOWED_COMPONENTS.Figure).toBe(Figure);
    const here = dirname(fileURLToPath(import.meta.url));
    const wiring = readFileSync(join(here, '..', '..', 'mdx-components.tsx'), 'utf8');
    expect(wiring).toContain("from './src/components/Figure.js'");
  });
});
