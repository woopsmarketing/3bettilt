import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { comboCountOf, RFI_RANGES } from '@gto-self/strategy-core';
import {
  HOME_GLOSSARY_PICKS,
  HOME_HEADLINE,
  heroHand,
  homeEquityExample,
} from '../../components/home/homeModel.js';
import {
  blogOfType,
  contentOfKind,
  contentPath,
  hrefOfContent,
  LEARN_ROADMAP,
  PUBLISHED_LESSONS,
  publishedOfKind,
  publishedStories,
} from '../../content/graph.js';
import { LEARN_STAGES } from '../../content/registry/learn/categories.js';
import { CONTENT_KINDS } from '../../content/types.js';
import { practiceHubCards } from '../../features/quiz/index.js';
import { positionAccessibleName } from '../../features/range/index.js';
import { formatPercent } from '../../features/tools/format.js';
import { toolHubEntries } from '../../features/tools/index.js';
import { ROUTES, routeById } from '../../lib/routes.js';
import { MIN_FAQ_ITEMS } from '../../lib/seo/faq.js';
import { PAGE_VISUALS } from '../../content/visuals.js';
import Home from './page.js';

/*
 * WHAT THIS FILE ASSERTS, AND WHY IT LOOKS LIKE THIS
 *
 * Content is being published into this repository while the homepage is being built
 * (stories, lesson rewrites), so a test that pinned a live count, a specific record, or
 * "whatever is unbuilt today" would be a scheduled failure rather than a check. Every
 * assertion below is a RULE:
 *
 *   - every link on the page resolves to something that actually exists,
 *   - no `PLANNED` record is ever linked,
 *   - each of the twelve bands is present, in order, with no heading level skipped,
 *   - the hero CTAs point where they say they point, and the hero's visual is the exact
 *     five cards named by the evaluator, not a raster and not a placeholder,
 *   - the roadmap is every lesson, in curriculum order, grouped by the learn module's stages,
 *   - the chart changes when a position is pressed and never drops its condition label,
 *   - the featured tool's number is the one `learn-core` computes,
 *   - the stories band features whatever is published today, and lies about nothing when
 *     nothing is,
 *   - the glossary strip is a CHOSEN set, not the head of the registry array,
 *   - the FAQ is about the site, never a poker question its own pages own,
 *   - the page claims neither popularity nor recency, and never says GTO.
 *
 * Where a number is on screen, the assertion compares it to the SAME graph or engine call
 * the page made — proving derivation, not the value.
 */

/** Every path this site can honestly link to right now: an available route, or a published
 *  record's own path. Anything else in an `href` is a dead link by definition. */
function resolvableHrefs(): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const route of ROUTES) {
    if (route.available) paths.add(route.path);
  }
  for (const kind of CONTENT_KINDS) {
    for (const record of publishedOfKind(kind)) {
      paths.add(contentPath(record));
    }
  }
  return paths;
}

/** Hrefs on the page with any `#fragment` removed — a hub anchor still targets the hub. */
function renderedHrefs(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll('a[href]')).map(
    (anchor) => (anchor.getAttribute('href') ?? '').split('#')[0] ?? '',
  );
}

/** The twelve bands, in the order the page runs them (see `page.tsx`'s module doc). */
const SECTION_NAMES = [
  '3BetTilt 한 줄 소개',
  '어디서 시작할까요?',
  `레슨 ${LEARN_ROADMAP.length}편, ${LEARN_STAGES.length}단계`,
  '자리를 바꾸면 표가 달라집니다',
  '궁금한 숫자를 그 자리에서',
  '3BetTilt가 가르치는 방식',
  '3BetTilt 스토리',
  '검색창에 치는 질문, 바로 답합니다',
  '읽었으면, 한 번 풀어보세요.',
  '모르는 말이 나오면',
  '자주 묻는 질문',
  '지금 시작하기',
] as const;

const PREVIEW_SECTION = '자리를 바꾸면 표가 달라집니다';

describe('3BetTilt homepage', () => {
  it('has exactly one h1, and it is the product line', () => {
    render(<Home />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    // Exact, not a substring match: this line is the page's product statement.
    expect(headings[0]?.textContent).toBe(HOME_HEADLINE);
    expect(HOME_HEADLINE).toBe('홀덤, 외우지 말고 이해하면서 배우세요.');
  });

  it('renders all twelve bands of the front page, in order', () => {
    render(<Home />);
    const regions = screen.getAllByRole('region');
    expect(regions.map((region) => region.getAttribute('aria-label') ?? '')).toHaveLength(
      SECTION_NAMES.length,
    );
    for (const name of SECTION_NAMES) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    const order = SECTION_NAMES.map((name) =>
      regions.indexOf(screen.getByRole('region', { name })),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('does not skip a heading level below the h1', () => {
    const { container } = render(<Home />);
    const levels = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      const previous = levels[index - 1] ?? 1;
      const current = levels[index] ?? 1;
      expect(current).toBeLessThanOrEqual(previous + 1);
    }
  });

  it('points the two hero CTAs at the first lesson and the tools hub, curriculum first', () => {
    render(<Home />);
    const ctas = within(screen.getByRole('group', { name: '시작하기' })).getAllByRole('link');
    expect(ctas.map((cta) => cta.textContent)).toEqual(['처음부터 배우기', '무료 도구 보기']);

    const firstLesson = PUBLISHED_LESSONS[0];
    if (firstLesson === undefined) throw new Error('fixture: no lesson is published');
    expect(firstLesson.order).toBe(LEARN_ROADMAP[0]?.order);
    const [start, tools] = ctas;
    if (start === undefined || tools === undefined) throw new Error('hero has two CTAs');
    expect(start).toHaveAttribute('href', hrefOfContent(firstLesson));
    expect(tools).toHaveAttribute('href', routeById('tools').path);
    // The filled brand button vs the outlined one — `HomeCallToAction`'s two variants.
    expect(start.className).toContain('bg-brand-600');
    expect(tools.className).not.toContain('bg-brand-600');
  });

  it('states only checkable micro-facts in the hero', () => {
    // No login, no payment, no affiliate surface exist anywhere in this app; the lesson
    // count is the graph's own. Nothing here is a rating, a user count or a date.
    render(<Home />);
    const hero = screen.getByRole('region', { name: '3BetTilt 한 줄 소개' });
    expect(within(hero).getByText('로그인 없음')).toBeInTheDocument();
    expect(within(hero).getByText('전부 무료')).toBeInTheDocument();
    expect(within(hero).getByText(`${PUBLISHED_LESSONS.length}편`)).toBeInTheDocument();
    expect(hero.textContent ?? '').not.toMatch(/명이|만 명|사용자|평점|★/u);
  });

  it('opens with the five exact cards, named by the evaluator and inert', () => {
    /*
     * Contract Z: card faces are code. The hero picture is one `role="img"` whose name is
     * what `bestFiveOf` says the five cards make — never a typed hand name — and it has no
     * tab stops in front of the first link on the page.
     */
    render(<Home />);
    const hero = screen.getByRole('region', { name: '3BetTilt 한 줄 소개' });
    const picture = within(hero).getByRole('img');
    expect(picture.getAttribute('aria-label')).toContain(heroHand().reading);
    expect(picture.getAttribute('aria-label')).toContain('스페이드 A K Q J 10');
    expect(picture.querySelectorAll('a, button, [tabindex], input')).toHaveLength(0);
    // The scene is the production photo; the cards stay code. The photo is decorative, so
    // the one `role="img"` above is still the only picture a reader is told about.
    expect(hero.querySelector('[data-hero-visual]')?.getAttribute('data-hero-visual')).toBe(
      'photo',
    );
    const photos = hero.querySelectorAll('img');
    expect(photos).toHaveLength(1);
    expect(photos[0]?.getAttribute('alt')).toBe('');
    expect(decodeURIComponent(photos[0]?.getAttribute('src') ?? '')).toContain(
      `/visuals/${PAGE_VISUALS.homeHero.file}`,
    );
  });

  it('reaches /about from the hero, the only page that states the numbers’ provenance', () => {
    render(<Home />);
    const hero = screen.getByRole('region', { name: '3BetTilt 한 줄 소개' });
    expect(within(hero).getByRole('link', { name: routeById('about').label })).toHaveAttribute(
      'href',
      routeById('about').path,
    );
  });

  it('links only to destinations that actually exist', () => {
    const { container } = render(<Home />);
    const hrefs = renderedHrefs(container);
    expect(hrefs.length).toBeGreaterThan(0);
    const resolvable = resolvableHrefs();
    for (const href of hrefs) {
      expect(resolvable.has(href), `unresolvable href on the homepage: ${href}`).toBe(true);
    }
  });

  it('never links a PLANNED record, whichever records are planned today', () => {
    const { container } = render(<Home />);
    const hrefs = new Set(renderedHrefs(container));
    for (const kind of CONTENT_KINDS) {
      for (const record of contentOfKind(kind)) {
        if (record.status === 'PUBLISHED') continue;
        expect(hrefs.has(contentPath(record))).toBe(false);
        expect(hrefOfContent(record)).toBeNull();
      }
    }
  });

  it('branches to every hub the site has, including the two the header leaves out', () => {
    const { container } = render(<Home />);
    const hrefs = new Set(renderedHrefs(container));
    for (const id of [
      'learn',
      'blog',
      'glossary',
      'hands',
      'tools',
      'practice',
      'search',
      'about',
    ]) {
      const route = routeById(id);
      expect(hrefs.has(route.path), `the homepage does not reach ${route.path}`).toBe(true);
    }
  });

  it('lays the roadmap out as every lesson, in curriculum order, by stage', () => {
    render(<Home />);
    const roadmap = screen.getByRole('list', { name: SECTION_NAMES[2] });
    const stages = roadmap.querySelectorAll('[data-stage]');
    expect(stages).toHaveLength(LEARN_STAGES.length);
    const orders = Array.from(roadmap.querySelectorAll('[data-order]')).map((item) =>
      Number(item.getAttribute('data-order')),
    );
    expect(orders).toEqual(LEARN_ROADMAP.map((lesson) => lesson.order));
    // Every published lesson is a link to its own page, in that order.
    const links = Array.from(roadmap.querySelectorAll('a[href]')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(links).toEqual(PUBLISHED_LESSONS.map((lesson) => hrefOfContent(lesson)));
  });

  it('derives every count it prints from the graph rather than a literal', () => {
    render(<Home />);
    expect(
      screen.getByText(
        new RegExp(`전체 ${LEARN_ROADMAP.length}편 중 ${PUBLISHED_LESSONS.length}편`, 'u'),
      ),
    ).toBeInTheDocument();

    const quizzes = practiceHubCards();
    const readyQuizzes = quizzes.filter((card) => card.route?.available === true).length;
    expect(
      screen.getByText(new RegExp(`전체 ${quizzes.length}개 퀴즈 중 ${readyQuizzes}개`, 'u')),
    ).toBeInTheDocument();

    const glossary = contentOfKind('glossary');
    const glossaryPublished = publishedOfKind('glossary');
    expect(
      screen.getByText(
        new RegExp(`전체 ${glossary.length}개 용어 중 ${glossaryPublished.length}개`, 'u'),
      ),
    ).toBeInTheDocument();
  });

  it('features one tool with a number learn-core computed, and lists the rest with their questions', () => {
    render(<Home />);
    const band = screen.getByRole('region', { name: SECTION_NAMES[4] });
    const featured = band.querySelector('[data-featured-tool]');
    expect(featured).not.toBeNull();
    // The example's number is the engine's, at the calculator's own precision.
    expect(
      within(band).getByText(formatPercent(homeEquityExample().result.equity)),
    ).toBeInTheDocument();
    // Featured + rows == the tools hub, each row an available link or "준비 중".
    const tools = toolHubEntries();
    const rows = band.querySelectorAll('[data-tool]');
    expect(rows.length + 1).toBe(tools.length);
    for (const entry of tools) {
      expect(band.textContent ?? '').toContain(entry.question);
      if (entry.route.available) {
        expect(
          within(band).getAllByRole('link', { name: new RegExp(entry.route.label, 'u') }).length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('features the published stories, and lies about nothing when there are none', () => {
    render(<Home />);
    const band = screen.getByRole('region', { name: '3BetTilt 스토리' });
    const stories = publishedStories();
    if (stories.length === 0) {
      expect(band.querySelector('[data-stories="coming-soon"]')).not.toBeNull();
      expect(band.querySelector('[data-featured-story]')).toBeNull();
      // The only link in an empty band is the blog hub.
      for (const anchor of Array.from(band.querySelectorAll('a[href]'))) {
        expect(anchor.getAttribute('href')).toBe(routeById('blog').path);
      }
    } else {
      const [first, ...rest] = stories;
      expect(band.querySelector('[data-featured-story]')?.getAttribute('data-featured-story')).toBe(
        first?.id,
      );
      expect(band.querySelectorAll('[data-story]')).toHaveLength(rest.length);
      expect(band.textContent ?? '').toContain(first?.hand.disclosure);
    }
  });

  it('indexes the search guides — every published one, as a link to its own page', () => {
    render(<Home />);
    const list = screen.getByRole('list', { name: SECTION_NAMES[7] });
    const guides = blogOfType('search-guide').filter((record) => record.status === 'PUBLISHED');
    const links = Array.from(list.querySelectorAll('a[href]')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(links).toEqual(guides.map((guide) => hrefOfContent(guide)));
  });

  it('curates the glossary strip instead of showing the head of the registry array', () => {
    render(<Home />);
    const list = screen.getByRole('list', { name: '첫 판에 자주 나오는 말' });
    const shown = Array.from(list.querySelectorAll('a[href]')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(shown).toHaveLength(HOME_GLOSSARY_PICKS.length);

    const headOfRegistry = publishedOfKind('glossary')
      .slice(0, shown.length)
      .map((record) => contentPath(record));
    expect(shown).not.toEqual(headOfRegistry);

    // The editorial intent: the words a reader meets in their very first hand — and every
    // pick resolves (a pick that stopped resolving would otherwise silently vanish).
    const published = new Map(
      publishedOfKind('glossary').map((record) => [record.id, contentPath(record)] as const),
    );
    for (const id of HOME_GLOSSARY_PICKS) {
      expect(shown, `${id} is not on the front page`).toContain(published.get(id));
    }
    for (const id of ['term-pot', 'term-flop', 'term-fold'])
      expect(HOME_GLOSSARY_PICKS).toContain(id);
  });

  it('changes the chart when the reader presses another position, and keeps its label', async () => {
    const user = userEvent.setup();
    const btn = RFI_RANGES.BTN;
    const utg = RFI_RANGES.UTG;
    if (btn === null || utg === null) throw new Error('fixture: missing range');
    render(<Home />);

    const preview = screen.getByRole('region', { name: PREVIEW_SECTION });
    expect(
      screen.getByText(`${comboCountOf(btn).toLocaleString('ko-KR')}가지`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: positionAccessibleName('UTG') }));

    expect(
      screen.getByText(`${comboCountOf(utg).toLocaleString('ko-KR')}가지`),
    ).toBeInTheDocument();
    expect(preview.textContent ?? '').toContain('학습용 기본 레인지');
    expect(preview.textContent ?? '').toContain('6인 · 100BB');
  });

  it('asks about the site in its FAQ, never a question its own content pages own', () => {
    render(<Home />);
    const faq = screen.getByRole('region', { name: '자주 묻는 질문' });
    const questions = within(faq)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => (heading.textContent ?? '').trim());
    expect(questions.length).toBeGreaterThanOrEqual(MIN_FAQ_ITEMS);

    const titles = new Set(
      CONTENT_KINDS.flatMap((kind) => publishedOfKind(kind).map((record) => record.title.trim())),
    );
    for (const question of questions) {
      expect(titles.has(question), `the homepage FAQ repeats a content page: ${question}`).toBe(
        false,
      );
    }

    const hrefs = Array.from(faq.querySelectorAll('a[href]')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(hrefs).toContain(routeById('about').path);
  });

  it('every FAQ answer is on screen — nothing is hidden behind a control', () => {
    render(<Home />);
    const faq = screen.getByRole('region', { name: '자주 묻는 질문' });
    expect(faq.querySelectorAll('details')).toHaveLength(0);
    expect(faq.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    const questions = within(faq).getAllByRole('heading', { level: 3 }).length;
    expect(faq.querySelectorAll('li').length).toBe(questions);
  });

  it('claims neither popularity nor recency in any heading', () => {
    const { container } = render(<Home />);
    const headings = Array.from(container.querySelectorAll('h1,h2,h3')).map(
      (heading) => heading.textContent ?? '',
    );
    for (const heading of headings) {
      expect(heading, `heading claims popularity: ${heading}`).not.toMatch(/인기/u);
      expect(heading, `heading claims recency: ${heading}`).not.toMatch(/최신|새 글|신규/u);
    }
  });

  it('never renders the string GTO', () => {
    const { container } = render(<Home />);
    expect(container.textContent ?? '').not.toContain('GTO');
  });
});
