import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { RANGE_LABEL, RANGE_PROVENANCE_SENTENCE } from '../../../../features/range/index.js';
import { routeById } from '../../../../lib/routes.js';
import { RANGE_FAQ, toolLessonIds } from '../../../../features/tools/index.js';
import { formatTitle } from '../../../../lib/seo/index.js';
import RangeExplorerPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * WP-D wiring test. `RangeExplorer` (the client island) already has its own thorough test
 * suite (`RangeExplorer.test.tsx`) — this file's job is only to prove the SERVER-rendered
 * shell around it: the page title/sub-line, the tool-first/explanation-after ordering (build
 * spec §11), and that the page's own closing prose uses real package numbers rather than a
 * literal (CLAUDE.md rules 2 and 5), the same discipline `src/app/page.test.tsx` pins for
 * the homepage scaffold.
 */
describe('/tools/range page shell', () => {
  it('renders the exact header copy the build spec specifies', () => {
    render(<RangeExplorerPage />);
    // `toHaveTextContent` is a SUBSTRING matcher, so this went on passing when WP-7a renamed
    // the heading to `13×13 핸드레인지 표` — green, and pinning nothing. Exact, now, like the
    // e2e assertion it is supposed to mirror.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('13×13 핸드레인지 표');
    expect(
      screen.getByText(
        '자리를 고르면 그 자리에서 레이즈하는 시작 패가 표에 칠해집니다. 두 자리를 겹쳐 비교할 수도 있습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the tool before the closing explanation section (build spec §11)', () => {
    render(<RangeExplorerPage />);
    const body = document.body.innerHTML;
    const toolIndex = body.indexOf('내 위치');
    const explanationIndex = body.indexOf('표는 어떻게 읽나요?');
    expect(toolIndex).toBeGreaterThan(-1);
    expect(explanationIndex).toBeGreaterThan(-1);
    expect(toolIndex).toBeLessThan(explanationIndex);
  });

  it('states the closing 169/1326 identity from strategy-core, not a literal', () => {
    render(<RangeExplorerPage />);
    expect(HAND_CLASS_COUNT).toBe(169);
    expect(COMBO_COUNT).toBe(1326);
    const explanation = screen.getByText(/두 장을 받는 방법은/);
    expect(explanation).toHaveTextContent(COMBO_COUNT.toLocaleString('ko-KR'));
    expect(explanation).toHaveTextContent(String(HAND_CLASS_COUNT));
  });

  /*
   * WP-Q2 / P2-m1. The heading was `${RANGE_LABEL}이란 무엇인가요?` and rendered
   * "학습용 기본 레인지이란" — 레인지 ends in a bare vowel, so the particle is 란. It is now
   * computed from the label, so the heading cannot silently regress if the label is reworded.
   */
  it('spells the definition heading with the particle the label actually takes', () => {
    render(<RangeExplorerPage />);
    expect(screen.getByText(`${RANGE_LABEL}란 무엇인가요?`)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(`${RANGE_LABEL}이란`);
  });

  /* WP-Q2 / P1-F7 — see `features/range/copy.ts`'s `RANGE_PROVENANCE_SENTENCE`. */
  it('describes the range as single-sourced rather than "여러 무료 포커 교육 자료"', () => {
    render(<RangeExplorerPage />);
    expect(document.body.textContent).not.toContain('여러 무료 포커 교육 자료');
    expect(document.body.textContent).toContain(RANGE_PROVENANCE_SENTENCE);
  });

  /*
   * WP-Q2 / P2-M1. The flagship tool — the page the homepage's loudest control pointed at —
   * had zero links back into `/learn/*` or `/glossary/*`.
   */
  it('links back to the range lesson, the way the other tools already do', () => {
    const lesson = contentById('poker-range');
    render(<RangeExplorerPage />);
    expect(screen.getByText('핸드레인지, 더 깊이')).toBeInTheDocument();
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

  /*
   * WP-1 §6 priority 8. Five tools sent the reader on to another tool; the flagship — the
   * destination of the homepage's primary control — sent them nowhere, so the page with the
   * most inbound traffic was the site's one dead end.
   */
  it('sends the reader on to another tool instead of ending the journey', () => {
    const route = routeById('toolStartingHand');
    expect(route.available).toBe(true);
    render(<RangeExplorerPage />);
    expect(screen.getByRole('link', { name: '시작 핸드 탐색기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('sets page metadata that leads with the search phrase and shares the <h1> topic', () => {
    // The `<title>` leads with the query (`홀덤 핸드레인지표`) and qualifies it with what the
    // tool shows; the `<h1>` names the same table for the reader. Brand suffix from `formatTitle`.
    render(<RangeExplorerPage />);
    const h1 = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    expect(h1).toContain('핸드레인지');
    expect(String(metadata.title).startsWith('홀덤 핸드레인지표')).toBe(true);
    expect(String(metadata.title)).toContain('6-max');
    expect(String(metadata.title).endsWith(formatTitle('').trim())).toBe(true);
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<RangeExplorerPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  /*
   * WP-4. The page's questions come from ONE typed array, which is what lets WP-7 emit a
   * `FAQPage` block that cannot describe a question the page does not ask (FISHTILT_STATE
   * ruling 107). `seo.spec.ts` requires each declared question to be a visible `<h3>`, so the
   * heading LEVEL is part of the contract, not styling.
   */
  it('renders every FAQ question as a visible h3, from the shared array', () => {
    render(<RangeExplorerPage />);
    // Scoped to the FAQ region: the provenance answer is the one shared sentence, which the
    // explorer's own "이 기준은 무엇인가요?" panel renders too, so a page-wide lookup would find
    // two identical paragraphs. What has to hold is that the FAQ shows its declared answer.
    const faq = within(screen.getByRole('region', { name: '자주 묻는 질문' }));
    for (const item of RANGE_FAQ) {
      expect(
        faq.getByRole('heading', { level: 3, name: item.question }),
        item.question,
      ).toBeInTheDocument();
      expect(faq.getByText(item.answer), item.question).toBeInTheDocument();
    }
  });

  /*
   * WP-1 §6 priority 9. Six tools carried no route to `/about` — the only page that says where
   * the numbers come from and that this site is affiliated with nobody.
   */
  it('reaches /about from the question that is actually asking where the numbers come from', () => {
    const about = routeById('about');
    expect(about.available).toBe(true);
    render(<RangeExplorerPage />);
    const links = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === about.path);
    expect(links, 'exactly one /about link, on one question').toHaveLength(1);
  });

  /*
   * WP-1 §6 priority 8. Every tool used to carry exactly one link back into the curriculum.
   */
  it('offers more than one way back into the lessons', () => {
    render(<RangeExplorerPage />);
    const lessonHrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith(`${ko('/learn')}/`));
    expect(new Set(lessonHrefs).size).toBeGreaterThanOrEqual(2);
    for (const id of toolLessonIds('range')) {
      const href = hrefOfContent(contentById(id));
      expect(lessonHrefs, id).toContain(href);
    }
  });
});
