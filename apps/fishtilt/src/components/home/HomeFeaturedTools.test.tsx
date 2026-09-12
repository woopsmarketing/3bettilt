import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { exactHeadsUpEquity } from '@gto-self/learn-core';
import { parseCards } from '@gto-self/shared';
import { formatPercent } from '../../features/tools/format.js';
import { FEATURED_TOOL_ID, toolHubEntries } from '../../features/tools/index.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HomeFeaturedTools } from './HomeFeaturedTools.js';
import { HOME_EQUITY_EXAMPLE, HOME_FEATURED_TOOL_ID, homeFeaturedTools } from './homeModel.js';

describe('HomeFeaturedTools', () => {
  it('features the equity calculator, not the tool the band above already demonstrates', () => {
    expect(HOME_FEATURED_TOOL_ID).not.toBe(FEATURED_TOOL_ID);
    const { featured, secondary } = homeFeaturedTools();
    expect(featured.route.id).toBe(HOME_FEATURED_TOOL_ID);
    expect(secondary.length + 1).toBe(toolHubEntries().length);
    expect(secondary.some((entry) => entry.route.id === FEATURED_TOOL_ID)).toBe(true);
  });

  it('prints the number learn-core computes for the named example, at the calculator’s precision', () => {
    const model = homeFeaturedTools();
    const { container } = renderBothThemes(<HomeFeaturedTools {...model} />);
    const hero = parseCards(HOME_EQUITY_EXAMPLE.hero);
    const villain = parseCards(HOME_EQUITY_EXAMPLE.villain);
    if (!hero.ok || !villain.ok) throw new Error('example cards');
    const outcome = exactHeadsUpEquity(hero.value, villain.value, []);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(container.textContent).toContain(formatPercent(outcome.value.equity));
    expect(container.textContent).toContain(outcome.value.runouts.toLocaleString('ko-KR'));
    // The two hands are drawn as card faces, named the way the tool guides name them.
    expect(screen.getByRole('group', { name: /내 패 카드: As Ks/u })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /상대 패 카드: Qh Qd/u })).toBeInTheDocument();
  });

  it('links every available tool once, with the question it answers beside it', () => {
    const model = homeFeaturedTools();
    const { container } = renderBothThemes(<HomeFeaturedTools {...model} />);
    const hrefs = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href'),
    );
    for (const entry of toolHubEntries()) {
      expect(container.textContent).toContain(entry.question);
      if (entry.route.available) expect(hrefs).toContain(entry.route.path);
    }
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('says what the tool does, never what to do: no verdict, no GTO', () => {
    const { container } = renderBothThemes(<HomeFeaturedTools {...homeFeaturedTools()} />);
    expect(container.textContent).not.toContain('GTO');
    expect(container.textContent).not.toMatch(/하세요|해야 합니다|추천/u);
  });
});
