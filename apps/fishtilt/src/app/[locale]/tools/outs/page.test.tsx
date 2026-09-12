import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { outsOdds, UNSEEN_AFTER_FLOP, UNSEEN_AFTER_TURN } from '@gto-self/learn-core';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { routeById } from '../../../../lib/routes.js';
import { OUTS_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import OutsPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * The client island has its own suite (`OutsCalculator.test.tsx`). This file pins the SERVER
 * shell: header copy, tool-before-explanation ordering (build spec §11), the cross-link into
 * the pot-odds calculator, and that the closing prose states no figure of its own — every
 * number on this page has to come from `learn-core` (CLAUDE.md rules 2 and 5).
 */
describe('/tools/outs page shell', () => {
  it('renders the page header', () => {
    render(<OutsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('아웃 계산기');
    expect(screen.getByText(/드로우가 완성될 확률을 정확하게 계산합니다/u)).toBeInTheDocument();
  });

  it('puts the tool above the explanation (build spec §11)', () => {
    render(<OutsPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('내 아웃은 몇 장인가요?');
    const explanationIndex = body.indexOf('아웃이 뭔가요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  it('states no figure of its own in the closing prose', () => {
    render(<OutsPage />);
    for (const heading of ['아웃이 뭔가요?', '왜 상대 카드를 빼지 않나요?']) {
      // The heading's wrapper is `SectionHeading`'s own div; the prose lives in the sibling
      // `ExplanationCard`, so the grid cell that holds BOTH is one level up.
      const section = screen.getByText(heading).closest('div')?.parentElement;
      expect(section?.textContent ?? '', heading).toContain(heading);
      expect(section?.textContent ?? '', heading).not.toMatch(/\d/u);
    }
  });

  it('presents the ×2 / ×4 rule as a shortcut to be checked, never as the answer', () => {
    render(<OutsPage />);
    expect(screen.getByText('×2 / ×4 규칙은 써도 되나요?')).toBeInTheDocument();
    expect(
      screen.getByText(/규칙이 실제보다 높게 나오기도 하고 낮게 나오기도/u),
    ).toBeInTheDocument();
  });

  /*
   * WP-Q2 / P1-F5. The card used to say the shortcut over-states as the out count grows
   * ("아웃이 많아질수록 실제보다 크게 계산되기 때문에"). Rather than pin a replacement string,
   * this derives the claim from `outsOdds`' own signed error, so the prose and the calculator
   * beside it can never disagree again. It fails against the original text.
   */
  it('states the shortcut error direction the way outsOdds actually reports it', () => {
    const signedErrors = (street: 'FLOP' | 'TURN') => {
      const unseen = street === 'FLOP' ? UNSEEN_AFTER_FLOP : UNSEEN_AFTER_TURN;
      const rows = [];
      for (let outs = 1; outs <= unseen; outs += 1) {
        const result = outsOdds({ outs, street });
        if (!result.ok) throw new Error(`outsOdds rejected ${outs} outs on the ${street}`);
        rows.push({ outs, shortcut: result.value.ruleOfTwoAndFour });
      }
      return rows;
    };

    const flop = signedErrors('FLOP');
    const turn = signedErrors('TURN');

    // ×2 UNDER-states at every out count, on both streets, and the undershoot GROWS with the
    // count — the opposite of what the card used to claim.
    expect(flop.every((row) => row.shortcut.nextCardError < 0)).toBe(true);
    expect(turn.every((row) => row.shortcut.byRiverError < 0)).toBe(true);
    const flopNextErrors = flop.map((row) => row.shortcut.nextCardError);
    expect(flopNextErrors).toEqual([...flopNextErrors].toSorted((a, b) => b - a));

    // ×4 goes both ways: under for small counts, over from 7 outs up. So "always over" and
    // "always under" are both false, and only a both-directions sentence is true.
    expect(flop.some((row) => row.shortcut.byRiverError < 0)).toBe(true);
    expect(flop.some((row) => row.shortcut.byRiverError > 0)).toBe(true);

    render(<OutsPage />);
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('아웃이 많아질수록 실제보다 크게');
    expect(body).toMatch(/높게 나오기도 하고 낮게 나오기도/u);
  });

  /*
   * WP-Q2 / P2-M1. This page had zero links back into `/learn/*` or `/glossary/*`, unlike the
   * three tools that already carry a lesson block.
   */
  it('links back to the outs lesson, the way the other tools already do', () => {
    const lesson = contentById('outs');
    render(<OutsPage />);
    expect(screen.getByText('아웃과 드로우, 더 깊이')).toBeInTheDocument();
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

  it('warns that a two-card probability assumes a street with no more betting', () => {
    render(<OutsPage />);
    expect(screen.getByText('두 장을 다 볼 수 있다고 가정해도 되나요?')).toBeInTheDocument();
  });

  it('sends the reader on to the pot odds calculator with a real link', () => {
    const route = routeById('toolPotOdds');
    expect(route.available).toBe(true);
    render(<OutsPage />);
    expect(screen.getByRole('link', { name: '팟 오즈 계산기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('has exactly one h1', () => {
    render(<OutsPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the tool', () => {
    expect(metadata.title).toContain('아웃');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<OutsPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<OutsPage />);
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
    render(<OutsPage />);
    for (const item of OUTS_FAQ) {
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
    render(<OutsPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<OutsPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('toolOuts')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
