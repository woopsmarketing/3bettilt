/**
 * Site-wide `<title>` / description coverage, over EVERY page in the sitemap.
 *
 * The metadata for all 141 indexable pages is computed here from the same sources the build
 * uses — each static route's own `metadata` export and `contentMetadata(record)` for every
 * content page — so a title rule is checked on every URL without rendering 141 documents in a
 * browser. `seo.spec.ts` checks the built HTML for the same properties at e2e time.
 *
 * The spot checks at the bottom pin the representative pages by exact string, so a title
 * change on one of them is a decision someone makes in this file, not a side effect.
 */
import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';
import { ALL_CONTENT } from '../../content/registry/index.js';
import { contentPath } from '../../content/graph.js';
import { HREFLANG, DEFAULT_LOCALE } from '../locale.js';
import { routeById, type RouteEntry } from '../routes.js';
import { canonicalUrl } from './canonical.js';
import { contentMetadata } from './metadata.js';
import { indexableContent, indexableRoutes } from './policy.js';
import { SITE_NAME, TITLE_BRAND_SEPARATOR, titleHead } from './site.js';
import { sitemapPaths } from './sitemapEntries.js';
import { metadata as homeMeta } from '../../app/[locale]/page.js';
import { metadata as learnMeta } from '../../app/[locale]/learn/page.js';
import { metadata as toolsMeta } from '../../app/[locale]/tools/page.js';
import { metadata as rangeMeta } from '../../app/[locale]/tools/range/page.js';
import { metadata as startingHandMeta } from '../../app/[locale]/tools/starting-hand/page.js';
import { metadata as equityMeta } from '../../app/[locale]/tools/equity/page.js';
import { metadata as potOddsMeta } from '../../app/[locale]/tools/pot-odds/page.js';
import { metadata as handCheckerMeta } from '../../app/[locale]/tools/hand-checker/page.js';
import { metadata as outsMeta } from '../../app/[locale]/tools/outs/page.js';
import { metadata as practiceMeta } from '../../app/[locale]/practice/page.js';
import { metadata as rangeQuizMeta } from '../../app/[locale]/practice/range-quiz/page.js';
import { metadata as handRankingQuizMeta } from '../../app/[locale]/practice/hand-ranking-quiz/page.js';
import { metadata as startingHandQuizMeta } from '../../app/[locale]/practice/starting-hand-quiz/page.js';
import { metadata as glossaryMeta } from '../../app/[locale]/glossary/page.js';
import { metadata as blogMeta } from '../../app/[locale]/blog/page.js';
import { metadata as handsMeta } from '../../app/[locale]/hands/page.js';
import { metadata as aboutMeta } from '../../app/[locale]/about/page.js';

/** Every indexable static route's own `metadata` export, by route id. */
const STATIC_METADATA: Readonly<Record<string, Metadata>> = {
  home: homeMeta,
  learn: learnMeta,
  tools: toolsMeta,
  range: rangeMeta,
  toolStartingHand: startingHandMeta,
  toolEquity: equityMeta,
  toolPotOdds: potOddsMeta,
  toolHandChecker: handCheckerMeta,
  toolOuts: outsMeta,
  practice: practiceMeta,
  practiceRange: rangeQuizMeta,
  practiceHandRanking: handRankingQuizMeta,
  practiceStartingHand: startingHandQuizMeta,
  glossary: glossaryMeta,
  blog: blogMeta,
  hands: handsMeta,
  about: aboutMeta,
};

interface PageMeta {
  readonly path: string;
  readonly meta: Metadata;
}

function staticPage(route: RouteEntry): PageMeta {
  const meta = STATIC_METADATA[route.id];
  if (meta === undefined) throw new Error(`no metadata export mapped for route ${route.id}`);
  return { path: route.path, meta };
}

const PAGES: readonly PageMeta[] = [
  ...indexableRoutes().map(staticPage),
  ...indexableContent(ALL_CONTENT).map((record) => ({
    path: contentPath(record),
    meta: contentMetadata(record),
  })),
];

const BRAND_SUFFIX = `${TITLE_BRAND_SEPARATOR}${SITE_NAME}`;
const titleOf = (page: PageMeta): string => String(page.meta.title ?? '');
const descriptionOf = (page: PageMeta): string => String(page.meta.description ?? '');
/** The title without the brand suffix. */
const bodyOf = (page: PageMeta): string => titleOf(page).slice(0, -BRAND_SUFFIX.length);

/** Words that occur more than `max` times, splitting on spaces and the title's own
 *  punctuation. */
function repeatedWords(text: string, max = 2): string[] {
  const counts = new Map<string, number>();
  for (const word of text.split(/[\s|·,?:()/—]+/u)) {
    if (word.length < 2) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n > max).map(([word]) => word);
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

describe('SEO metadata coverage — every sitemap page', () => {
  it('covers exactly the sitemap, which still lists 141 URLs', () => {
    expect(PAGES).toHaveLength(141);
    expect(sitemapPaths()).toHaveLength(141);
    expect(new Set(PAGES.map((page) => page.path))).toEqual(new Set(sitemapPaths()));
  });

  it('gives every page a non-empty title that ends with the brand exactly once', () => {
    for (const page of PAGES) {
      const title = titleOf(page);
      expect(bodyOf(page).trim(), page.path).not.toBe('');
      expect(title.endsWith(BRAND_SUFFIX), `${page.path}: ${title}`).toBe(true);
      expect(title.split(SITE_NAME).length - 1, `${page.path}: ${title}`).toBe(1);
      expect(title, page.path).not.toMatch(/3bettilt\.com|·\s*3BetTilt/iu);
    }
  });

  it('has no duplicate titles and no duplicate descriptions', () => {
    expect(duplicates(PAGES.map(titleOf))).toEqual([]);
    expect(duplicates(PAGES.map(descriptionOf))).toEqual([]);
  });

  it('keeps the canonical at the page`s own path and the hreflang set unchanged', () => {
    for (const page of PAGES) {
      const canonical = canonicalUrl(page.path);
      expect(page.meta.alternates?.canonical, page.path).toBe(canonical);
      expect(page.meta.alternates?.languages, page.path).toEqual({
        [HREFLANG[DEFAULT_LOCALE]]: canonical,
        'x-default': canonical,
      });
      expect(page.meta.robots, page.path).toEqual({ index: true, follow: true });
    }
  });

  it('uses the same title for the tab, the social card and twitter', () => {
    for (const page of PAGES) {
      expect(page.meta.openGraph?.title, page.path).toBe(titleOf(page));
      expect(page.meta.twitter?.title, page.path).toBe(titleOf(page));
      expect(page.meta.openGraph?.description, page.path).toBe(descriptionOf(page));
    }
  });

  it('writes Korean titles with no forced English SEO words', () => {
    for (const page of PAGES) {
      expect(titleHead(bodyOf(page)), page.path).toMatch(/[가-힣]/u);
      expect(bodyOf(page), page.path).not.toMatch(/\b(?:poker|holdem|hold'?em|texas|GTO)\b/iu);
    }
  });

  it('does not stuff keywords: short titles, no word more than twice', () => {
    for (const page of PAGES) {
      const body = bodyOf(page);
      expect(body.length, `${page.path}: ${body}`).toBeLessThanOrEqual(48);
      expect(repeatedWords(body), `${page.path}: ${body}`).toEqual([]);
      // At most one qualifier: `검색어 | 설명`, never a chain of pipes.
      expect(body.split(' | ').length, `${page.path}: ${body}`).toBeLessThanOrEqual(2);
    }
  });

  it('gives every page a real 1–2 sentence description', () => {
    for (const page of PAGES) {
      const description = descriptionOf(page);
      expect(description.length, `${page.path}: ${description}`).toBeGreaterThanOrEqual(50);
      expect(description.length, `${page.path}: ${description}`).toBeLessThanOrEqual(160);
      expect(description, page.path).toMatch(/[가-힣]/u);
      // Prose may say `같은` three times; a word four times in two sentences is a keyword list.
      expect(repeatedWords(description, 3), `${page.path}: ${description}`).toEqual([]);
    }
  });

  it('never describes the equity metric as the chance of winning (ADR-0082)', () => {
    for (const page of PAGES) {
      const text = `${titleOf(page)} ${descriptionOf(page)}`;
      expect(text, page.path).not.toMatch(/이길 확률|이기는 비율|%를 이깁니다/u);
    }
  });
});

describe('SEO titles — representative pages', () => {
  const byPath = new Map(PAGES.map((page) => [page.path, page]));
  const title = (sitePath: string): string => {
    const path = sitePath === '/' ? routeById('home').path : `${routeById('home').path}${sitePath}`;
    const page = byPath.get(path);
    if (page === undefined) throw new Error(`not in the sitemap: ${path}`);
    return titleOf(page);
  };

  it.each([
    ['/', '텍사스 홀덤 배우기 | 홀덤 족보·핸드레인지·승률 계산기 - 3BetTilt'],
    ['/learn', '텍사스 홀덤 배우기 | 규칙·족보·포지션·프리플랍 - 3BetTilt'],
    ['/learn/pot-odds', '팟오즈 계산법 | 콜에 필요한 최소 승률 구하기 - 3BetTilt'],
    ['/tools/equity', '홀덤 승률·에퀴티 계산기 | 무료 포커 계산기 - 3BetTilt'],
    ['/glossary/three-bet', '3벳 뜻 | 홀덤·포커 용어 설명 - 3BetTilt'],
    ['/glossary/vpip', 'VPIP 뜻 | 홀덤·포커 용어 설명 - 3BetTilt'],
    ['/hands/aa', 'AA 승률·순위 | 텍사스 홀덤 프리플랍 핸드 가이드 - 3BetTilt'],
    ['/blog/aks-vs-ako', 'AKs vs AKo 차이는? 수티드가 실제로 얼마나 중요한가 - 3BetTilt'],
    [
      '/blog/qq-vs-72o-flop-227',
      '3벳에 72o가 콜했고 플랍은 2-2-7이었다 | QQ vs 72o 핸드 리뷰 - 3BetTilt',
    ],
    ['/practice/hand-ranking-quiz', '홀덤 족보 퀴즈 | 포커 핸드 순위 연습 - 3BetTilt'],
    ['/about', '소개 - 3BetTilt'],
  ])('%s', (sitePath, expected) => {
    expect(title(sitePath)).toBe(expected);
  });
});
