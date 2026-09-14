/**
 * What every page's `<head>` must contain, asserted through the builder rather than
 * through any one page — so the properties hold for the 110 pages nobody hand-wrote.
 *
 * The content record is a fixture, for the reason `policy.test.ts` documents: the
 * interesting case is a record the registry marks unindexable, and the product is trying
 * to stop having any.
 */
import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';
import type { BlogRecord, LearnRecord } from '../../content/types.js';
import { contentMetadata, formatTitle, hreflangAlternates, pageMetadata } from './metadata.js';
import { OG_IMAGE_PATH, SITE_LOCALE, SITE_NAME, SITE_ORIGIN } from './site.js';
import { HREFLANG } from '../locale.js';
import { DEFAULT_LOCALE, localePath } from '../locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

function blogRecord(over: Partial<BlogRecord> = {}): BlogRecord {
  return {
    kind: 'blog',
    id: 'fixture-article',
    slug: 'fixture-article',
    title: 'AA는 얼마나 자주 나오나요?',
    description: '테스트가 직접 만든 블로그 레코드입니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    contentType: 'search-guide',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
    ...over,
  };
}

function learnRecord(over: Partial<LearnRecord> = {}): LearnRecord {
  return { ...blogRecord(), kind: 'learn', order: 3, ...over } as LearnRecord;
}

/** `og:type` is a discriminant Next's `OpenGraph` union does not expose as a plain field. */
function ogType(meta: Metadata): string | undefined {
  return (meta.openGraph as { type?: string } | undefined)?.type;
}

describe('formatTitle', () => {
  it('appends the site name exactly once', () => {
    expect(formatTitle('팟 오즈 계산기')).toBe(`팟 오즈 계산기 - ${SITE_NAME}`);
    expect(formatTitle(`팟 오즈 계산기 - ${SITE_NAME}`)).toBe(`팟 오즈 계산기 - ${SITE_NAME}`);
    expect(formatTitle(SITE_NAME)).toBe(SITE_NAME);
  });

  it('keeps the brand last, after the qualifier, and never spells the domain', () => {
    const title = formatTitle('홀덤 팟오즈 계산기 | 무료 포커 계산기');
    expect(title).toBe(`홀덤 팟오즈 계산기 | 무료 포커 계산기 - ${SITE_NAME}`);
    expect(title).not.toMatch(/3bettilt\.com/iu);
  });
});

describe('pageMetadata', () => {
  const meta = pageMetadata({
    path: ko('/tools/pot-odds'),
    title: '팟 오즈 계산기',
    description: '콜하려면 몇 퍼센트는 이겨야 하는지 계산합니다.',
    index: true,
  });

  it('states an absolute canonical with no query string', () => {
    expect(meta.alternates?.canonical).toBe(`${SITE_ORIGIN}${ko('/tools/pot-odds')}`);
  });

  it('canonicalises interactive state back to the stable tool URL', () => {
    const filtered = pageMetadata({
      path: ko('/tools/range?hero=BTN&stack=100&spot=RFI'),
      title: '핸드레인지 탐색기',
      description: '설명',
      index: true,
    });
    expect(filtered.alternates?.canonical).toBe(`${SITE_ORIGIN}${ko('/tools/range')}`);
  });

  it('uses the same title for the tab and the social card', () => {
    expect(meta.title).toBe(`팟 오즈 계산기 - ${SITE_NAME}`);
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.twitter?.title).toBe(meta.title);
  });

  it('names the site, the locale and the canonical URL in the Open Graph block', () => {
    expect(meta.openGraph).toMatchObject({
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url: `${SITE_ORIGIN}${ko('/tools/pot-odds')}`,
      type: 'website',
    });
  });

  it('carries an absolute Open Graph image', () => {
    const images = meta.openGraph?.images;
    expect(Array.isArray(images)).toBe(true);
    expect(JSON.stringify(images)).toContain(`${SITE_ORIGIN}${OG_IMAGE_PATH}`);
  });

  it('names its own locale and x-default as hreflang alternates of the canonical — D-S3-06', () => {
    const canonical = `${SITE_ORIGIN}${ko('/tools/pot-odds')}`;
    expect(meta.alternates?.languages).toEqual({
      [HREFLANG[DEFAULT_LOCALE]]: canonical,
      'x-default': canonical,
    });
    // Only languages the site has: two entries, no `en`.
    expect(Object.keys(meta.alternates?.languages ?? {})).toHaveLength(2);
  });

  it('computes the hreflang set from the editions a document exists in', () => {
    const path = ko('/learn/pot-odds');
    const canonical = `${SITE_ORIGIN}${path}`;
    // Default: the page's own locale is its only edition — today's whole truth.
    expect(hreflangAlternates(canonical, path)).toEqual(
      hreflangAlternates(canonical, path, [DEFAULT_LOCALE]),
    );
    // An edition list that omits the page itself would publish a set that is not reciprocal.
    expect(() => hreflangAlternates(canonical, path, [])).toThrow(/own editions/u);
    expect(() => hreflangAlternates(canonical, '/learn/pot-odds')).toThrow(/localised path/u);
  });

  it('reads og:locale off the page path', () => {
    expect((meta.openGraph as { locale?: string } | undefined)?.locale).toBe(SITE_LOCALE);
  });

  it('emits no hreflang for a noindex page — it is not an edition of anything', () => {
    const hidden = pageMetadata({
      path: ko('/search'),
      title: '검색',
      description: '설명',
      index: false,
    });
    expect(hidden.alternates?.canonical).toBe(`${SITE_ORIGIN}${ko('/search')}`);
    expect(hidden.alternates?.languages).toBeUndefined();
  });

  it('refuses a locale-less path rather than emitting a canonical that 404s', () => {
    expect(() =>
      pageMetadata({ path: '/tools/pot-odds', title: 'x', description: 'y', index: true }),
    ).toThrow(/supported locale/u);
  });

  it('turns the index decision into a robots directive, and always follows', () => {
    expect(meta.robots).toEqual({ index: true, follow: true });
    const hidden = pageMetadata({
      path: ko('/search'),
      title: '검색',
      description: '설명',
      index: false,
    });
    expect(hidden.robots).toEqual({ index: false, follow: true });
  });
});

describe('contentMetadata', () => {
  it('derives everything from the record, including the path', () => {
    const meta = contentMetadata(blogRecord());
    expect(meta.title).toBe(`AA는 얼마나 자주 나오나요? - ${SITE_NAME}`);
    expect(meta.description).toBe('테스트가 직접 만든 블로그 레코드입니다.');
    expect(meta.alternates?.canonical).toBe(`${SITE_ORIGIN}${ko('/blog/fixture-article')}`);
  });

  it('follows the record`s own index flags, and never overrides them', () => {
    expect(contentMetadata(blogRecord()).robots).toEqual({ index: true, follow: true });
    expect(contentMetadata(blogRecord({ indexable: false })).robots).toEqual({
      index: false,
      follow: true,
    });
    expect(contentMetadata(blogRecord({ status: 'PLANNED', readMinutes: null })).robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it('marks the two article kinds as `article` and the reference kinds as `website`', () => {
    expect(ogType(contentMetadata(learnRecord()))).toBe('article');
    expect(ogType(contentMetadata(blogRecord()))).toBe('article');
    expect(
      ogType(
        contentMetadata({
          ...blogRecord(),
          kind: 'glossary',
          term: 'Range',
          aliases: [],
          shortDefinition: '한 줄 정의',
        }),
      ),
    ).toBe('website');
    expect(ogType(contentMetadata({ ...blogRecord(), kind: 'hands', handKey: 'AKs' }))).toBe(
      'website',
    );
  });
});

describe('content titles and descriptions', () => {
  it('lets an explicit seoTitle win on any kind, and never touches the H1', () => {
    const meta = contentMetadata(learnRecord({ seoTitle: '팟오즈 계산법 | 테스트' }));
    expect(meta.title).toBe(`팟오즈 계산법 | 테스트 - ${SITE_NAME}`);
  });

  it('prefers an explicit seoDescription over the deck', () => {
    const meta = contentMetadata(blogRecord({ seoDescription: '검색 결과에만 쓰는 설명입니다.' }));
    expect(meta.description).toBe('검색 결과에만 쓰는 설명입니다.');
    expect(meta.openGraph?.description).toBe(meta.description);
  });
});
