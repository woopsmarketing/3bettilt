import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routeById } from '../../../../lib/routes.js';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { EQUITY_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import EquityCalculatorPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * The client island has its own suite (`EquityCalculator.test.tsx`). This file pins the
 * SERVER shell: header copy, tool-before-explanation ordering (build spec §11), the
 * cross-links (one live tool, one honestly-inert lesson), and that no route is ever linked
 * while its own registry entry says `available: false`.
 */
describe('/tools/equity page shell', () => {
  it('renders the page header', () => {
    render(<EquityCalculatorPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('승률 계산기');
  });

  it('puts the tool above the explanation (build spec §11)', () => {
    render(<EquityCalculatorPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('카드를 선택하세요');
    const explanationIndex = body.indexOf('승률(Equity)이 뭔가요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  it('explains the tie/split and the legal board lengths — the two beginner traps this tool guards against', () => {
    render(<EquityCalculatorPage />);
    expect(screen.getByText('비김(무승부)은 어떻게 되나요?')).toBeInTheDocument();
    expect(screen.getByText(/팟을 반씩 나눠 갖습니다/u)).toBeInTheDocument();
    expect(screen.getByText('보드는 왜 0장, 3장, 4장, 5장만 되나요?')).toBeInTheDocument();
    // WP-Q2 / P2-M5: the site canon is 플랍 / 프리플랍, and a reader who learns 플랍 in the
    // lessons must not meet 플롭 on the tool the lesson points at.
    expect(
      screen.getByText(/프리플랍\(0장\), 플랍\(3장\), 턴\(4장\), 리버\(5장\)/u),
    ).toBeInTheDocument();
  });

  it('sends the reader on to a real, available tool (pot odds)', () => {
    const route = routeById('toolPotOdds');
    expect(route.available).toBe(true);
    render(<EquityCalculatorPage />);
    expect(screen.getByRole('link', { name: '팟 오즈 계산기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('links to the equity lesson, now that it is written', () => {
    // This assertion used to say the opposite — the lesson was PLANNED, so the page rendered
    // an inert 준비 중 badge. WP-H3 published it and the honest expectation flipped. The page
    // itself needed no change: it reads `hrefOfContent` off the content graph rather than
    // hard-coding a state, so it followed the data. Same resolution as
    // `tools/hand-checker/page.test.tsx`; see ruling 40 in `docs/FISHTILT_STATE.md`.
    //
    // The inert path is still covered, by the local fixtures in `ToolCTA.test.tsx`,
    // `Term.test.tsx` and `RelatedContent.test.tsx`, which own that contract with fixtures
    // they control rather than a live record that happens to be unpublished.
    const lesson = contentById('equity');
    const href = hrefOfContent(lesson);
    expect(href).not.toBeNull();

    render(<EquityCalculatorPage />);
    expect(screen.getByText('승률, 더 깊이')).toBeInTheDocument();
    const linked = screen.getAllByRole('link').some((el) => el.getAttribute('href') === href);
    expect(linked, `no link points at ${String(href)}`).toBe(true);
  });

  it('never links a tool route the registry marks unavailable', () => {
    render(<EquityCalculatorPage />);
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      // Every rendered link either points at a route this test independently confirms is
      // `available: true`, or is not a `/tools/...` link at all (e.g. the equity lesson,
      // handled by content status rather than the route registry).
      if (href.startsWith('/tools/')) {
        const matching = ['toolPotOdds', 'toolHandChecker', 'toolOuts', 'toolEquity']
          .map((id) => routeById(id))
          .find((route) => route.path === href);
        expect(matching?.available, href).toBe(true);
      }
    }
  });

  it('has exactly one h1', () => {
    render(<EquityCalculatorPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the tool', () => {
    expect(metadata.title).toContain('승률·에퀴티 계산기');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<EquityCalculatorPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<EquityCalculatorPage />);
    // Root-relative site paths, or same-page fragments (the guide's table of contents).
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').toMatch(/^(\/(?!\/)|#[a-z-]+$)/u);
    }
  });

  /*
   * WP-4. The page's questions come from ONE typed array, which is what lets WP-7 emit a
   * `FAQPage` block that cannot describe a question the page does not ask (FISHTILT_STATE
   * ruling 107). `seo.spec.ts` requires each declared question to be a visible `<h3>`, so the
   * heading LEVEL is part of the contract, not styling.
   */
  it('renders every FAQ question as a visible h3, from the shared array', () => {
    render(<EquityCalculatorPage />);
    for (const item of EQUITY_FAQ) {
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
    render(<EquityCalculatorPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<EquityCalculatorPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('toolEquity')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
