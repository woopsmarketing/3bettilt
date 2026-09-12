import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  bestFiveExample,
  categoryFrequencyRows,
  equityMatchupExamples,
  equityTieExample,
  guideCount,
  guidePercent,
  outsTableRows,
  potOddsWalkthrough,
  showdownExamples,
  strongestRows,
  suitedVersusOffsuit,
} from '../../features/tools/index.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { EQUITY_GUIDE_HEADINGS, EquityGuide } from './EquityGuide.js';
import { HAND_CHECKER_GUIDE_HEADINGS, HandCheckerGuide } from './HandCheckerGuide.js';
import { OUTS_GUIDE_HEADINGS, OutsGuide } from './OutsGuide.js';
import { POT_ODDS_GUIDE_HEADINGS, PotOddsGuide } from './PotOddsGuide.js';
import { STARTING_HAND_GUIDE_HEADINGS, StartingHandGuide } from './StartingHandGuide.js';

/*
 * The five calculator/explorer guides share one contract with `RangeGuide`: every TOC entry is
 * a named region with an h2; every number on the page is the engine's; nothing says GTO; no
 * interactive control is added under the tool. The per-guide facts pinned here are the ones
 * the prose leans on.
 */
const GUIDES = [
  ['EquityGuide', <EquityGuide key="e" />, EQUITY_GUIDE_HEADINGS],
  ['PotOddsGuide', <PotOddsGuide key="p" />, POT_ODDS_GUIDE_HEADINGS],
  ['OutsGuide', <OutsGuide key="o" />, OUTS_GUIDE_HEADINGS],
  ['HandCheckerGuide', <HandCheckerGuide key="h" />, HAND_CHECKER_GUIDE_HEADINGS],
  ['StartingHandGuide', <StartingHandGuide key="s" />, STARTING_HAND_GUIDE_HEADINGS],
] as const;

describe.each(GUIDES)('%s', (_name, element, headings) => {
  it('renders every TOC entry as a named region with an h2, and no controls', () => {
    const { container } = renderBothThemes(element);
    const toc = screen.getByRole('navigation', { name: '목차' });
    for (const heading of headings) {
      expect(within(toc).getByRole('link', { name: heading.text })).toHaveAttribute(
        'href',
        `#${heading.id}`,
      );
      const region = screen.getByRole('region', { name: heading.text });
      expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(heading.text);
    }
    expect(container.querySelectorAll('button:not([popovertarget]), input, select')).toHaveLength(
      0,
    );
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});

describe('EquityGuide numbers', () => {
  it('prints the mirror matchup with equity exactly 50.00% and the four matchups at two decimals', () => {
    renderBothThemes(<EquityGuide />);
    const tie = equityTieExample();
    const region = screen.getByRole('region', { name: '이김 · 비김 · 승률의 차이' });
    expect(within(region).getAllByText(guidePercent(tie.result.equity)).length).toBeGreaterThan(0);
    expect(within(region).getAllByText(guidePercent(tie.result.tieProb)).length).toBeGreaterThan(0);
    const table = screen.getByRole('region', { name: '대결 예시 네 가지' });
    for (const example of equityMatchupExamples()) {
      expect(
        within(table).getAllByText(guidePercent(example.result.equity)).length,
      ).toBeGreaterThan(0);
      expect(within(table).getAllByText(guideCount(example.result.runouts)).length).toBeGreaterThan(
        0,
      );
    }
    // No one-decimal percentage anywhere in the guide: the calculator's own three are the
    // only `^\d{1,3}\.\d%$` texts on the page (equity.spec.ts counts them).
    expect(document.body.textContent).not.toMatch(/\d\.\d%(?!p)/u);
  });
});

describe('PotOddsGuide numbers', () => {
  it('prints the walkthrough from potOdds()', () => {
    renderBothThemes(<PotOddsGuide />);
    const walk = potOddsWalkthrough();
    const region = screen.getByRole('region', { name: '예시로 따라가기' });
    expect(
      within(region).getAllByText(guidePercent(walk.odds.requiredEquity)).length,
    ).toBeGreaterThan(0);
    expect(region.textContent).toContain('30 BB');
    expect(region.textContent).toContain('50 BB');
  });
});

describe('OutsGuide numbers', () => {
  it('prints every table row at two decimals with the shortcut beside the exact value', () => {
    renderBothThemes(<OutsGuide />);
    const region = screen.getByRole('region', { name: '×2 · ×4 규칙과 정확한 값' });
    for (const row of outsTableRows('FLOP')) {
      expect(
        within(region).getAllByText(guidePercent(row.odds.byRiverProb)).length,
      ).toBeGreaterThan(0);
    }
    // The e2e spec's exact-text probes for the calculator must not match the guide.
    expect(screen.queryByText('×4 규칙', { exact: true })).toBeNull();
    expect(screen.queryByText('리버 한 장', { exact: true })).toBeNull();
  });
});

describe('HandCheckerGuide numbers', () => {
  it("prints the evaluator's readings and verdicts, and the nine category counts", () => {
    renderBothThemes(<HandCheckerGuide />);
    const best = bestFiveExample();
    expect(screen.getByRole('region', { name: '일곱 장 중 다섯 장' }).textContent).toContain(
      best.result.reading,
    );
    const ties = screen.getByRole('region', { name: '키커와 비기는 경우' });
    for (const example of showdownExamples()) {
      const block = within(ties).getByRole('region', { name: example.title });
      expect(block.textContent).toContain(example.a.reading);
      expect(block.textContent).toContain(example.verdict === 0 ? '비깁니다' : '이깁니다');
    }
    const categories = screen.getByRole('region', { name: '9개 족보와 나오는 빈도' });
    for (const row of categoryFrequencyRows()) {
      expect(within(categories).getAllByText(guideCount(row.count)).length).toBeGreaterThan(0);
    }
    // The calculator's default reading must not be duplicated by the guide (e2e getByText).
    expect(screen.queryByText('에이스와 킹 투페어')).toBeNull();
  });
});

describe('StartingHandGuide numbers', () => {
  it('prints the dataset rows and the suited/offsuit gap', () => {
    renderBothThemes(<StartingHandGuide />);
    const region = screen.getByRole('region', { name: '가장 강한 다섯, 가장 약한 다섯' });
    for (const row of strongestRows(5)) {
      expect(within(region).getAllByText(guidePercent(row.entry.equity)).length).toBeGreaterThan(0);
    }
    const pair = suitedVersusOffsuit();
    const suited = screen.getByRole('region', { name: '수티드와 오프수트' });
    expect(
      within(suited).getAllByText(guidePercent(pair.suited.entry.equity)).length,
    ).toBeGreaterThan(0);
    expect(suited.textContent).toContain(`${(pair.equityGap * 100).toFixed(2)}%p`);
  });
});
