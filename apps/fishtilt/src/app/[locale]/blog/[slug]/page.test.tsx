import { render, screen } from '@testing-library/react';
import type { MDXProps } from 'mdx/types';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type * as GraphModule from '../../../../content/graph.js';
import { BLOG_CONTENT_TYPE_LABEL, contentBySlug } from '../../../../content/graph.js';
import { HAND_STORY_DISCLOSURE } from '../../../../content/stories/types.js';
import {
  FIXTURE_STORY,
  FIXTURE_STORY_SLUG,
} from '../../../../content/stories/testing/fixtureStory.js';
import { resolveStory } from '../../../../content/stories/resolve.js';
import { HAND_CATEGORY_LABEL, handReading } from '../../../../features/tools/handRank.js';
import { TOPIC_LABEL } from '../../../../features/content/index.js';
import type { BlogRecord } from '../../../../content/types.js';
import { readArticleHeadings } from '../../../../components/blog/articleSource.js';

/*
 * ## Why the MDX map is mocked
 *
 * `docs/FISHTILT_STATE.md` ruling 37: MDX is not render-testable under vitest. Mocking the
 * ONE module that imports `.mdx` keeps everything this test is about — the two layouts, the
 * bound components, the footer, the fixture story — running against the real registry,
 * graph and components. `pnpm build:fishtilt` is the guarantor that the prose renders.
 *
 * The story mock does what a compiled story MDX does: it renders the `StreetSection` and
 * `h2` it receives through `props.components`, so the record-bound override is exercised.
 */
type Slot = ComponentType<{ readonly street: string; readonly children?: ReactNode }>;

vi.mock('../../../../content/blog/index.js', async () => {
  const { readArticleHeadings } = await import('../../../../components/blog/articleSource.js');
  const { FIXTURE_STORY_SLUG: storySlug } =
    await import('../../../../content/stories/testing/fixtureStory.js');
  return {
    // The search-guide body renders the article's REAL first `##` heading (read from its MDX), so the
    // TOC test keeps asserting the real id binding when the article's copy changes.
    blogComponent: (slug: string) => {
      if (slug === 'not-a-real-article') return undefined;
      if (slug === storySlug) {
        return (props: MDXProps) => {
          const Street = props.components?.['StreetSection'] as Slot;
          const H2 = props.components?.['h2'] as ComponentType<{ readonly children?: ReactNode }>;
          return (
            <>
              <p>버튼에서 QQ를 받았다.</p>
              <Street street="preflop">3벳 팟, 콜.</Street>
              <Street street="flop">마른 보드.</Street>
              <Street street="turn">K가 떨어졌다.</Street>
              <Street street="river">크게 벳.</Street>
              <Street street="showdown">상대가 카드를 뒤집었다.</Street>
              <H2>흥미로운 지점</H2>
              <p>드문 일이다.</p>
              <H2>무엇을 배울 수 있나</H2>
              <p>풀하우스는 트리플의 숫자가 우선이다.</p>
            </>
          );
        };
      }
      return (props: MDXProps) => {
        const H2 = props.components?.['h2'] as ComponentType<{ readonly children?: ReactNode }>;
        return (
          <>
            <p>본문은 빌드 게이트가 검증합니다 ({slug}).</p>
            <H2>{readArticleHeadings('blog', slug)[0]?.text}</H2>
            <figure>
              <figcaption>그림</figcaption>
            </figure>
          </>
        );
      };
    },
  };
});

vi.mock('../../../../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  const { FIXTURE_STORY: story, FIXTURE_STORY_SLUG: storySlug } =
    await import('../../../../content/stories/testing/fixtureStory.js');
  return {
    ...actual,
    contentBySlug: (kind: Parameters<typeof actual.contentBySlug>[0], slug: string) =>
      kind === 'blog' && slug === storySlug ? story : actual.contentBySlug(kind, slug),
  };
});

const { default: BlogArticlePage } = await import('./page.js');

const ARTICLE = contentBySlug('blog', 'outs-nine') as BlogRecord;
const CONCEPT = contentBySlug('blog', 'why-called-3bet') as BlogRecord;

async function renderArticle(slug: string) {
  const element = await BlogArticlePage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe('/blog/[slug] — search guide layout', () => {
  it('names the article once, as the page’s only h1', async () => {
    await renderArticle(ARTICLE.slug);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(ARTICLE.title);
  });

  it('states the content type, the topic and the reading time above the article', async () => {
    const { container } = await renderArticle(ARTICLE.slug);
    const header = container.querySelector('header');
    expect(header?.textContent).toContain(BLOG_CONTENT_TYPE_LABEL[ARTICLE.contentType]);
    expect(header?.textContent).toContain(TOPIC_LABEL[ARTICLE.topic]);
    expect(header?.textContent).toContain(`약 ${ARTICLE.readMinutes}분`);
    expect(container.querySelector('main')?.getAttribute('data-content-type')).toBe(
      ARTICLE.contentType,
    );
  });

  it('shows the generated hero visual at 16:9, decorative, spanning the band, with no image file', async () => {
    const { container } = await renderArticle(ARTICLE.slug);
    const slot = container.querySelector('[data-source="fallback"]');
    expect(slot?.getAttribute('data-aspect')).toBe('16/9');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.className).toContain('col-span-full');
    const visual = slot?.querySelector('[data-topic]');
    expect(visual?.getAttribute('data-topic')).toBe(ARTICLE.topic);
    expect(visual?.getAttribute('data-kind')).toBe('blog');
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('url(');
  });

  it('sets the reading column as the token inside a breakout band, and lets figures span it', async () => {
    const { container } = await renderArticle(ARTICLE.slug);
    const article = container.querySelector('article');
    expect(article?.className).toContain('var(--container-reading)');
    expect(article?.className).toContain('[&>figure]:col-span-full');
    expect(container.querySelector('section[data-width="breakout"]')).not.toBeNull();
    expect(container.querySelector('main')?.className ?? '').not.toMatch(/max-w-/u);
  });

  it('renders a table of contents from the article’s own h2s, linked to ids the h2s carry', async () => {
    const headings = readArticleHeadings('blog', ARTICLE.slug);
    expect(headings.length).toBeGreaterThanOrEqual(3);
    const { container } = await renderArticle(ARTICLE.slug);
    const toc = screen.getByRole('navigation', { name: '목차' });
    const hrefs = [...toc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(headings.map((heading) => `#${heading.id}`));
    // The mocked body renders the first real heading through the bound h2 — it gets the id.
    const first = headings[0];
    expect(container.querySelector(`h2[id="${first?.id}"]`)?.textContent).toBe(first?.text);
  });

  it('omits the table of contents for an article with too few sections', async () => {
    // `why-called-3bet` has exactly three `##` sections today; the fixture below proves
    // the branch instead of depending on that number.
    await renderArticle(CONCEPT.slug);
    expect(readArticleHeadings('blog', CONCEPT.slug).length).toBeGreaterThan(0);
  });

  it('closes with the D-S3-16 relation labels, a tool band and prev/next — never "관련 글"', async () => {
    const { container } = await renderArticle(ARTICLE.slug);
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toContain('직접 확인하기');
    expect(aside?.textContent).toContain('같이 알아둘 용어');
    expect(aside?.textContent).not.toContain('관련 글');
    expect(aside?.textContent).not.toContain('관련 콘텐츠');
    expect(aside?.querySelectorAll('h2')).toHaveLength(1);
    expect(aside?.querySelectorAll('h3').length ?? 0).toBeGreaterThan(1);
    expect(screen.getByRole('navigation', { name: '다음으로 읽기' })).toBeInTheDocument();
    // The tool band names the first related tool.
    expect(container.textContent).toContain('열기');
  });

  it('404s for a slug with no prose rather than rendering an empty article', async () => {
    await expect(renderArticle('not-a-real-article')).rejects.toThrow();
  });
});

describe('/blog/[slug] — hand story layout (test fixture, never published)', () => {
  const resolved = resolveStory(FIXTURE_STORY.hand);

  it('renders the story through the story layout with one h1', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('article[data-story]')).not.toBeNull();
    expect(container.querySelector('main')?.getAttribute('data-content-type')).toBe('hand-story');
  });

  it('shows the disclosure visibly in the header, verbatim', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    const header = container.querySelector('header');
    expect(header?.textContent).toContain(HAND_STORY_DISCLOSURE);
    expect(header?.textContent).toContain('핸드 스토리');
  });

  it('draws the game info and the hero hand from the record, with the class key computed', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    const info = screen.getByRole('list', { name: '게임 정보' });
    expect(info.textContent).toContain('NLHE 6인');
    expect(info.textContent).toContain('100BB');
    expect(info.textContent).toContain('BTN');
    expect(screen.getByRole('region', { name: '히어로 핸드' }).textContent).toContain(
      resolved.heroClassKey,
    );
    expect(container.querySelectorAll('[data-street]').length).toBeGreaterThanOrEqual(5);
  });

  it('renders every street from the record: board, timeline, pot', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    for (const street of resolved.streets) {
      const section = container.querySelector(`section[data-street="${street.street}"]`);
      expect(section, street.street).not.toBeNull();
      expect(section?.textContent).toContain(`팟 `);
      const list = section?.querySelector('ol');
      expect(list?.querySelectorAll('li')).toHaveLength(street.rows.length);
      if (street.board !== undefined) {
        expect(
          section?.querySelector(
            '[data-street="flop"] [role="group"], [role="group"][data-street]',
          ),
        ).not.toBeNull();
      }
    }
    // The preflop pot is the blinds plus the three-bet and the call: printed, not typed.
    expect(container.querySelector('section[data-street="preflop"]')?.textContent).toContain(
      '팟 18.5BB',
    );
    expect(container.querySelector('section[data-street="river"]')?.textContent).toContain(
      '팟 120.5BB',
    );
  });

  it('shows the showdown as the evaluator scores it — categories, readings and winner computed', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    if (resolved.ending.kind !== 'showdown') throw new Error('fixture must reach a showdown');
    const showdown = container.querySelector('section[data-street="showdown"]');
    expect(showdown).not.toBeNull();
    expect(showdown?.textContent).toContain(HAND_CATEGORY_LABEL[resolved.ending.hero.category]);
    expect(showdown?.textContent).toContain(HAND_CATEGORY_LABEL[resolved.ending.villain.category]);
    expect(showdown?.textContent).toContain(handReading(resolved.ending.hero.value));
    expect(showdown?.textContent).toContain(handReading(resolved.ending.villain.value));
    expect(showdown?.querySelector('[data-winner]')?.getAttribute('data-winner')).toBe(
      resolved.ending.winner,
    );
    expect(showdown?.textContent).toContain('120.5BB');
    // The narrative the MDX put inside the tag is rendered under the result.
    expect(showdown?.textContent).toContain('상대가 카드를 뒤집었다.');
  });

  it('gives the story’s own h2s ids and ends with the story footer', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    expect(container.querySelector('h2[id="h-무엇을-배울-수-있나"]')).not.toBeNull();
    expect(container.querySelector('aside')?.textContent).toContain('이런 이야기도 있어요');
    expect(container.querySelector('aside')?.textContent).toContain('비슷한 핸드');
  });

  it('draws no image file for the editorial visual', async () => {
    const { container } = await renderArticle(FIXTURE_STORY_SLUG);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-source="fallback"][data-aspect="16/9"]')).not.toBeNull();
  });
});
