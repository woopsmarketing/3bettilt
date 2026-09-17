import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routeById } from '../../../../lib/routes.js';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import {
  categoryLabelList,
  CATEGORIES_WITH_KICKER,
  CATEGORIES_WITHOUT_KICKER,
} from '../../../../features/tools/handRank.js';
import { HAND_CHECKER_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import HandCheckerPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * The client island has its own suite (`HandChecker.test.tsx`). This file pins the SERVER
 * shell: header copy, tool-before-explanation ordering (build spec §11), the cross-links
 * (both now live), and that closing prose states no figure of its own.
 */
describe('/tools/hand-checker page shell', () => {
  it('renders the page header', () => {
    render(<HandCheckerPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('핸드 체커');
  });

  it('puts the tool above the explanation (build spec §11)', () => {
    render(<HandCheckerPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('카드를 선택하세요');
    const explanationIndex = body.indexOf('족보가 뭔가요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  it('explains the kicker and the wheel — the two beginner traps the spec calls out', () => {
    render(<HandCheckerPage />);
    expect(screen.getByText('숫자가 같으면 누가 이기나요?')).toBeInTheDocument();
    expect(screen.getAllByText(/키커 \(Kicker\)/u).length).toBeGreaterThan(0);
    expect(screen.getByText('에이스는 항상 가장 높은 카드인가요?')).toBeInTheDocument();
    expect(screen.getByText(/A-2-3-4-5로 이어지면/u)).toBeInTheDocument();
  });

  /*
   * WP-Q2 / P1-F6. The card used to say a kicker breaks EVERY tie. `compareHands` says
   * otherwise for the four categories that consume all five cards — `handRank.test.ts` proves
   * that against the evaluator; this pins that the page now scopes the claim and names the
   * split-pot outcome. Fails against the original card.
   */
  it('scopes the kicker claim to the categories that actually leave one', () => {
    render(<HandCheckerPage />);
    const body = document.body.textContent ?? '';
    expect(body).toContain(categoryLabelList(CATEGORIES_WITH_KICKER));
    expect(body).toContain(categoryLabelList(CATEGORIES_WITHOUT_KICKER));
    expect(body).toContain('팟을 나눠 가집니다');
    // The unqualified universal claim is gone.
    expect(body).not.toContain('그마저 같다면 남은 카드 중 가장 높은 카드');
  });

  it('sends the reader on to a real, available tool (outs)', () => {
    const route = routeById('toolOuts');
    expect(route.available).toBe(true);
    render(<HandCheckerPage />);
    expect(screen.getByRole('link', { name: '아웃 계산기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('links to the hand-rankings lesson, now that it is written', () => {
    // This assertion used to say the opposite — the lesson was PLANNED, so the page rendered
    // an inert 준비 중 badge. WP-H1 published it and the expectation honestly flipped. The
    // page itself needed no change, which is the whole point of reading `hrefOfContent` off
    // the content graph instead of hard-coding a state: the product followed the data.
    //
    // The inert path is still covered, by the local fixtures in `ToolCTA.test.tsx`,
    // `Term.test.tsx` and `RelatedContent.test.tsx`. Per ruling 26 those own that contract
    // with fixtures they control, so it no longer needs a live record that happens to be
    // unpublished — which is exactly what broke this test.
    const lesson = contentById('hand-rankings');
    const href = hrefOfContent(lesson);
    expect(href).not.toBeNull();

    render(<HandCheckerPage />);
    expect(screen.getByText(lesson.title)).toBeInTheDocument();
    const linked = screen.getAllByRole('link').some((el) => el.getAttribute('href') === href);
    expect(linked, `no link points at ${String(href)}`).toBe(true);
  });

  it('has exactly one h1', () => {
    render(<HandCheckerPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the tool', () => {
    expect(metadata.title).toContain('핸드 판정기');
    expect(metadata.title).toContain('족보');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<HandCheckerPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<HandCheckerPage />);
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
    render(<HandCheckerPage />);
    for (const item of HAND_CHECKER_FAQ) {
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
    render(<HandCheckerPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<HandCheckerPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('toolHandChecker')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
