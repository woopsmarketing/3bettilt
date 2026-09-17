import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import { HAND_STRENGTH } from '@gto-self/learn-core';
import { RANGE_LABEL } from '../../../../features/range/index.js';
import {
  METHODOLOGY_SENTENCE,
  PLAYABILITY_CAVEAT_SENTENCE,
  RANGE_DISTINCTION_SENTENCE,
} from '../../../../features/strength/index.js';
import { routeById } from '../../../../lib/routes.js';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { STARTING_HAND_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import { formatTitle } from '../../../../lib/seo/index.js';
import StartingHandExplorerPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * WP-E2 wiring test. `StartingHandExplorer` (the client island) has its own thorough test
 * suite (`StartingHandExplorer.test.tsx`) — this file only proves the SERVER-rendered shell:
 * the page title, tool-first/explanation-after ordering (build spec §11), that the
 * methodology copy actually renders, and that every number in the closing sections is read
 * from the packages rather than a literal (CLAUDE.md rules 2 and 5) — the same discipline
 * `/tools/range/page.test.tsx` pins for its own page.
 */
describe('/tools/starting-hand page shell', () => {
  it('renders the page heading', () => {
    render(<StartingHandExplorerPage />);
    // Exact, not `toHaveTextContent`'s substring match — a partial match keeps passing
    // through a rewrite of the line it is meant to pin.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '169개 시작 패, 강한 순서로 보기',
    );
  });

  it('renders the tool before the closing explanation sections (build spec §11)', () => {
    render(<StartingHandExplorerPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('보는 방식');
    const explanationIndex = body.indexOf('이 순위는 어떻게 계산했나요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  it('states the methodology sentence and the strategy-distinction sentence verbatim', () => {
    render(<StartingHandExplorerPage />);
    expect(screen.getByText(METHODOLOGY_SENTENCE)).toBeInTheDocument();
    expect(
      screen.getByText(
        '이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다.',
      ),
    ).toBeInTheDocument();
  });

  /*
   * WP-Q2 / P1-F4 (D1). `HandStrengthEntry.equity` is hero's expected share of the pot with
   * ties split, not P(win) — the gap reaches ~2.9pp on numbers this page prints to two
   * decimals. So no sentence on this page may call it 이기는 비율 / 이길 확률, and the
   * definitional sentence has to carry the tie convention. Fails against the original copy.
   */
  it('never describes the metric as the proportion of the time you win', () => {
    render(<StartingHandExplorerPage />);
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('이기는 비율');
    expect(body).not.toContain('이길 확률');
    expect(METHODOLOGY_SENTENCE).toContain('팟에서 가져갈 것으로 기대되는 몫');
    expect(METHODOLOGY_SENTENCE).toContain('비기는 경우는 절반만 이긴 것으로');
    expect(RANGE_DISTINCTION_SENTENCE).not.toContain('승률');
  });

  /*
   * WP-Q2 / P2-M7. The playability caveat opened with "그래서" — a connector whose antecedent
   * lives in a different card two columns away — and asserted WHICH hands are hard to play and
   * WHICH hands people like, i.e. unbacked strategy inside the sentence written to prevent
   * exactly that. The 뜻은 아닙니다 refusal stays (D5).
   */
  it('answers the "좋은 패 순서" question without a dangling connector or an unbacked claim', () => {
    render(<StartingHandExplorerPage />);
    expect(PLAYABILITY_CAVEAT_SENTENCE.startsWith('그래서')).toBe(false);
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('잘 플레이하기 어려운');
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('사람들이 좋아하는');
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('수트드');
    expect(PLAYABILITY_CAVEAT_SENTENCE).toContain('뜻은 아니');
    expect(screen.getByText(PLAYABILITY_CAVEAT_SENTENCE)).toBeInTheDocument();
  });

  /*
   * WP-Q2 / P1-F12. Both range CTAs dropped the `학습용 기본 레인지` label and read as a
   * description of what players actually do at a table.
   */
  it('keeps the range label on the CTA into the range explorer', () => {
    render(<StartingHandExplorerPage />);
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('실제 어떤 패를 플레이하는지');
    expect(body).not.toContain('실제로 어떤 패를 여는지');
    expect(
      screen.getByText(`포지션별 ${RANGE_LABEL}에 어떤 패가 들어 있는지 궁금하다면`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${RANGE_LABEL}에 어떤 패가 들어 있는지는 포지션마다`, 'u')),
    ).toBeInTheDocument();
  });

  it('states the dataset provenance from HAND_STRENGTH, not a literal', () => {
    render(<StartingHandExplorerPage />);
    expect(HAND_STRENGTH.method).toBe('EXACT');
    const provenance = screen.getByText(/추정이 아닙니다/);
    expect(provenance).toHaveTextContent(
      HAND_STRENGTH.enumeration.boardsPerClass.toLocaleString('ko-KR'),
    );
    expect(provenance).toHaveTextContent(HAND_STRENGTH.trialCount.toLocaleString('ko-KR'));
  });

  it('states the "top X%" combo-cut explanation with real counts from strategy-core', () => {
    render(<StartingHandExplorerPage />);
    expect(HAND_CLASS_COUNT).toBe(169);
    expect(COMBO_COUNT).toBe(1326);
    const explanation = screen.getByText(/핸드 이름 중 X%가 아니라/);
    expect(explanation).toHaveTextContent(String(HAND_CLASS_COUNT));
    expect(explanation).toHaveTextContent(COMBO_COUNT.toLocaleString('ko-KR'));
  });

  it('links to the Equity Calculator and the Range Explorer, both already available', () => {
    render(<StartingHandExplorerPage />);
    expect(screen.getByRole('link', { name: '승률 계산기 열기' })).toHaveAttribute(
      'href',
      ko('/tools/equity'),
    );
    expect(screen.getByRole('link', { name: '핸드레인지 표 열기' })).toHaveAttribute(
      'href',
      ko('/tools/range'),
    );
    expect(
      screen.getByText(`포지션별 ${RANGE_LABEL}에 어떤 패가 들어 있는지 궁금하다면`),
    ).toBeInTheDocument();
  });

  it('sets page metadata that names the tool', () => {
    /*
     * WP-7a: the `<title>` and the `<h1>` are deliberately different here. The title is the
     * tool's NAME — the one `routes.ts`, the `/tools` card, the hand-off button and the
     * `WebApplication` block all use — and the heading is a sentence saying what the 169 rows
     * are ordered by. Both are pinned, and so is the fact that they differ, so collapsing one
     * into the other stays a decision somebody makes on purpose.
     */
    render(<StartingHandExplorerPage />);
    const h1 = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    // The `<title>` is the search phrase (홀덤 시작 핸드 순위표); it is deliberately not the
    // long `<h1>`.
    expect(String(metadata.title)).toContain('시작 핸드 순위표');
    expect(String(metadata.title).endsWith(formatTitle('').trim())).toBe(true);
    expect(metadata.title).not.toBe(formatTitle(h1));
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<StartingHandExplorerPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  /*
   * WP-4. The page's questions come from ONE typed array, which is what lets WP-7 emit a
   * `FAQPage` block that cannot describe a question the page does not ask (FISHTILT_STATE
   * ruling 107). `seo.spec.ts` requires each declared question to be a visible `<h3>`, so the
   * heading LEVEL is part of the contract, not styling.
   */
  it('renders every FAQ question as a visible h3, from the shared array', () => {
    render(<StartingHandExplorerPage />);
    for (const item of STARTING_HAND_FAQ) {
      expect(
        screen.getByRole('heading', { level: 3, name: item.question }),
        item.question,
      ).toBeInTheDocument();
      expect(screen.getByText(item.answer), item.question).toBeInTheDocument();
    }
  });

  /*
   * WP-1 §6 priority 9. Six tools carried no route to `/about` — the only page that says where
   * the numbers come from and that this site is affiliated with nobody.
   */
  it('reaches /about from the question that is actually asking where the numbers come from', () => {
    const about = routeById('about');
    expect(about.available).toBe(true);
    render(<StartingHandExplorerPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<StartingHandExplorerPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('toolStartingHand')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
