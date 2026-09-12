import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hrefOfContent, publishedOfKind } from '../../content/graph.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HomeGlossaryStrip } from './HomeGlossaryStrip.js';
import { HOME_GLOSSARY_PICKS, homeGlossaryPicks } from './homeModel.js';

describe('HomeGlossaryStrip', () => {
  it('every pick resolves to a published term, and is rendered with its own aliases', () => {
    const terms = homeGlossaryPicks();
    expect(terms.map((term) => term.id)).toEqual(HOME_GLOSSARY_PICKS);
    const { container } = renderBothThemes(
      <HomeGlossaryStrip
        terms={terms}
        glossaryHref="/x/glossary"
        searchHref="/x/search"
        handsHref="/x/hands"
      />,
    );
    const list = screen.getByRole('list', { name: '첫 판에 자주 나오는 말' });
    for (const term of terms) {
      expect(screen.getByRole('link', { name: term.title })).toHaveAttribute(
        'href',
        hrefOfContent(term),
      );
      const alias = term.aliases[0];
      if (alias !== undefined) expect(list.textContent).toContain(alias);
    }
    expect(container.querySelectorAll('a[href]')).toHaveLength(terms.length + 3);
  });

  it('is a chosen set, not the head of the registry', () => {
    const head = publishedOfKind('glossary')
      .slice(0, HOME_GLOSSARY_PICKS.length)
      .map((r) => r.id);
    expect(HOME_GLOSSARY_PICKS).not.toEqual(head);
  });

  it('drops a lookup link whose route is not built rather than rendering a dead one', () => {
    const { container } = renderBothThemes(
      <HomeGlossaryStrip
        terms={[]}
        glossaryHref="/x/glossary"
        searchHref={null}
        handsHref={null}
      />,
    );
    expect(container.querySelectorAll('a[href]')).toHaveLength(1);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
