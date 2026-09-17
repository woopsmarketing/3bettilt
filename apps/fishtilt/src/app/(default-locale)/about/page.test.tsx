import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HAND_STORY_DISCLOSURE } from '../../../content/stories/types.js';
import { RANGE_PROVENANCE_SENTENCE } from '../../../features/range/index.js';
import { METHODOLOGY_SENTENCE } from '../../../features/strength/index.js';
import AboutPage, { ABOUT_SECTIONS } from './page.js';

describe('/about', () => {
  it('has exactly one h1', () => {
    render(<AboutPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('states plainly, exactly once, that it is not affiliated with any poker room', () => {
    render(<AboutPage />);
    // Exactly once: `about.spec.ts` reads `getByText('제휴하지 않았습니다', { exact: false })` in
    // strict mode, so a second mention anywhere on the page breaks the e2e.
    expect(screen.getAllByText(/제휴하지 않았습니다/u)).toHaveLength(1);
  });

  it('answers the trust questions in the brief, in order, and links each from a table of contents', () => {
    render(<AboutPage />);
    const expected = [
      '3BetTilt란?',
      '누구를 위한 사이트인가?',
      '무엇을 제공하는가?',
      '숫자는 어떻게 계산하는가?',
      '정확성 원칙',
      '레인지 표가 말하는 것과 말하지 않는 것',
      '교육 목적',
      '핸드 스토리는 어떻게 만드는가?',
      '오류를 발견했을 때',
      '하지 않는 것',
    ];
    expect(ABOUT_SECTIONS.map((section) => section.text)).toEqual(expected);
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(expected);

    const toc = screen.getByRole('navigation', { name: '목차' });
    for (const section of ABOUT_SECTIONS) {
      expect(within(toc).getByRole('link', { name: section.text })).toHaveAttribute(
        'href',
        `#${section.id}`,
      );
      expect(document.getElementById(section.id), section.id).not.toBeNull();
    }
  });

  /*
   * WP-Q2 / P1-F7. This page used to say the range was NOT copied from a specific site and
   * WAS computed here — the opposite of what `packages/strategy-core/src/preflop/tables.ts`
   * says about its own data ("transcribed VERBATIM", single-sourced; only SB is recomputed).
   * Fails against the original paragraph.
   */
  it('describes the range with the one shared sentence, with only SB recomputed', () => {
    render(<AboutPage />);
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('특정 사이트의 데이터를 베낀 것이 아니라');
    expect(body).toContain(RANGE_PROVENANCE_SENTENCE);
    expect(RANGE_PROVENANCE_SENTENCE).toContain('모든 상황의 정답을 뜻하지 않');
    expect(RANGE_PROVENANCE_SENTENCE).toContain('SB');
  });

  it('describes the numbers from the shared methodology sentences, never a second wording', () => {
    render(<AboutPage />);
    const body = document.body.textContent ?? '';
    expect(body).toContain(METHODOLOGY_SENTENCE);
    expect(body).toContain(HAND_STORY_DISCLOSURE);
  });

  it('never says GTO, and never names a person, team, company, date or contact address', () => {
    render(<AboutPage />);
    // The visible prose only — the breadcrumb's JSON-LD carries `@context`/`@type`.
    const main = screen.getByRole('main').cloneNode(true) as HTMLElement;
    for (const script of Array.from(main.querySelectorAll('script'))) script.remove();
    const body = main.textContent ?? '';
    expect(body).not.toMatch(/GTO/iu);
    expect(body).not.toMatch(/@/u);
    expect(body).not.toMatch(/(19|20)\d\d년/u);
    expect(body).not.toMatch(/주식회사|Inc\.|Ltd|사업자|대표|팀원|창업자|설립/u);
    expect(body).not.toMatch(/이메일|전화|문의처/u);
  });

  it('carries no affiliate or deposit link', () => {
    render(<AboutPage />);
    /*
     * WP-7a: this used to assert that the page had NO links at all, which was the strongest
     * available statement while the page had none. The assertion states the property it was
     * always protecting, and states it more precisely: every link on this page stays inside
     * 3BetTilt (or is an in-page anchor). An affiliate link, a casino link or a deposit link is
     * by definition off-site, so this fails on the first one regardless of how many internal
     * links the page grows.
     */
    const links = screen.queryAllByRole('link');
    expect(links.length).toBeGreaterThan(ABOUT_SECTIONS.length);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('/') || href.startsWith('#'), href).toBe(true);
      // `//host/…` is an absolute URL wearing a root-relative disguise.
      expect(href.startsWith('//'), href).toBe(false);
    }
  });
});
