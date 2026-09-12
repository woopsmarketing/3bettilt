import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routeById } from '../../../../lib/routes.js';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { POT_ODDS_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import PotOddsPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * The client island has its own suite (`PotOddsCalculator.test.tsx`). This file pins the
 * SERVER shell: the header copy, the tool-before-explanation ordering (build spec §11), the
 * cross-link into the outs calculator, and — the property that matters most on a teaching
 * page — that the closing prose states no figure of its own. Every number a reader sees here
 * has to have been computed by `learn-core` from what they typed (CLAUDE.md rules 2 and 5).
 */
describe('/tools/pot-odds page shell', () => {
  it('renders the page header', () => {
    render(<PotOddsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('팟 오즈 계산기');
    expect(screen.getByText(/몇 퍼센트를 이겨야 본전인지/u)).toBeInTheDocument();
  });

  it('puts the tool above the explanation (build spec §11)', () => {
    render(<PotOddsPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('지금 팟에 있는 돈');
    const explanationIndex = body.indexOf('팟 오즈가 뭔가요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  /*
   * WP-Q2 / P2-M1. This page had zero links back into `/learn/*` or `/glossary/*`, unlike the
   * three tools that already carry a lesson block.
   */
  it('links back to the pot-odds lesson, the way the other tools already do', () => {
    const lesson = contentById('pot-odds');
    render(<PotOddsPage />);
    expect(screen.getByText('팟 오즈, 더 깊이')).toBeInTheDocument();
    const href = hrefOfContent(lesson);
    const title = screen.getByText(lesson.title);
    if (href !== null) {
      expect(title.closest('a')).toHaveAttribute('href', href);
    } else {
      // A PLANNED lesson renders the inert 준비 중 card, never a link that would 404.
      expect(title.closest('a')).toBeNull();
      expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
    }
  });

  it('states no figure of its own in the closing prose', () => {
    render(<PotOddsPage />);
    // Everything after the calculator is prose. Any digit there would be a number a reader
    // cannot check, which is exactly what the calculator above exists to avoid.
    for (const heading of ['팟 오즈가 뭔가요?', '왜 내가 낸 콜도 팟에 더하나요?']) {
      // The heading's wrapper is `SectionHeading`'s own div; the prose lives in the sibling
      // `ExplanationCard`, so the grid cell that holds BOTH is one level up.
      const section = screen.getByText(heading).closest('div')?.parentElement;
      expect(section?.textContent ?? '', heading).toContain(heading);
      expect(section?.textContent ?? '', heading).not.toMatch(/\d/u);
    }
  });

  it('sends the reader on to the outs calculator with a real link', () => {
    const route = routeById('toolOuts');
    expect(route.available).toBe(true);
    render(<PotOddsPage />);
    expect(screen.getByRole('link', { name: '아웃 계산기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('has exactly one h1', () => {
    render(<PotOddsPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the tool', () => {
    expect(metadata.title).toContain('팟 오즈');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<PotOddsPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<PotOddsPage />);
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
    render(<PotOddsPage />);
    for (const item of POT_ODDS_FAQ) {
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
    render(<PotOddsPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<PotOddsPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('toolPotOdds')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
