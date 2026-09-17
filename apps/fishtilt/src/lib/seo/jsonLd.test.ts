/**
 * The structured-data builders.
 *
 * Every assertion here is about TRUTHFULNESS, not about coverage: that each block declares
 * the type it claims, that the URLs inside it are the page's own canonical, that a field
 * this project cannot substantiate is absent rather than guessed, and that a builder given
 * nothing emits nothing rather than an empty shell.
 */
import { describe, expect, it } from 'vitest';
import type { BlogRecord, LearnRecord } from '../../content/types.js';
import {
  articleJsonLd,
  breadcrumbListJsonLd,
  collectionPageJsonLd,
  definedTermJsonLd,
  definedTermSetJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  webApplicationJsonLd,
  webSiteJsonLd,
  type JsonLdObject,
} from './jsonLd.js';
import { OG_IMAGE_PATH, SITE_NAME, SITE_ORIGIN } from './site.js';
import type { BreadcrumbItem } from './breadcrumbs.js';
import { DEFAULT_LOCALE, localePath } from '../locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

const TRAIL: readonly BreadcrumbItem[] = [
  { label: '홈', path: ko('/'), current: false },
  { label: '배우기', path: ko('/learn'), current: false },
  { label: '팟 오즈', path: ko('/learn/pot-odds'), current: true },
];

function article(over: Partial<BlogRecord> = {}): BlogRecord {
  return {
    kind: 'blog',
    id: 'fixture-article',
    slug: 'fixture-article',
    title: '보드 그대로 쓰기',
    description: '픽스처 설명입니다.',
    level: 'BASIC',
    topic: 'hand-strength',
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

/** Round-trips a block exactly as a crawler would: through the serialiser, then `JSON.parse`. */
function parsed(block: JsonLdObject): Record<string, unknown> {
  return JSON.parse(serializeJsonLd(block)) as Record<string, unknown>;
}

describe('breadcrumbListJsonLd', () => {
  const block = parsed(breadcrumbListJsonLd(TRAIL));

  it('declares a BreadcrumbList in the schema.org context', () => {
    expect(block['@context']).toBe('https://schema.org');
    expect(block['@type']).toBe('BreadcrumbList');
  });

  it('mirrors the visible trail exactly, in order, 1-based', () => {
    expect(block['itemListElement']).toEqual([
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: '배우기', item: `${SITE_ORIGIN}${ko('/learn')}` },
      {
        '@type': 'ListItem',
        position: 3,
        name: '팟 오즈',
        item: `${SITE_ORIGIN}${ko('/learn/pot-odds')}`,
      },
    ]);
  });
});

describe('articleJsonLd', () => {
  const block = parsed(articleJsonLd(article()));

  it('declares an Article whose headline and URL are the page`s own', () => {
    expect(block['@type']).toBe('Article');
    expect(block['headline']).toBe('보드 그대로 쓰기');
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/blog/fixture-article')}`);
    expect(block['mainEntityOfPage']).toEqual({
      '@type': 'WebPage',
      '@id': `${SITE_ORIGIN}${ko('/blog/fixture-article')}`,
    });
  });

  it('omits every date, because no content record carries one', () => {
    expect(block).not.toHaveProperty('datePublished');
    expect(block).not.toHaveProperty('dateModified');
  });

  it('names 3BetTilt as publisher and claims no human author', () => {
    expect(block['publisher']).toEqual({
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    });
    expect(block['author']).toEqual(block['publisher']);
  });

  it('names the page`s featured visual as an ImageObject at its real size', () => {
    const image = parsed(
      articleJsonLd(article(), {
        src: '/visuals/two-face-down-hole-cards.jpg',
        spec: { width: 1920, height: 1080 },
      }),
    )['image'];
    expect(image).toEqual({
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/visuals/two-face-down-hole-cards.jpg`,
      width: 1920,
      height: 1080,
    });
  });

  it('falls back to the shared social card when the featured file is missing', () => {
    expect(block['image']).toBe(`${SITE_ORIGIN}${OG_IMAGE_PATH}`);
    expect(parsed(articleJsonLd(article(), null))['image']).toBe(`${SITE_ORIGIN}${OG_IMAGE_PATH}`);
  });

  it('works the same for a lesson', () => {
    const lesson = { ...article(), kind: 'learn', order: 2 } as unknown as LearnRecord;
    expect(parsed(articleJsonLd(lesson))['url']).toBe(
      `${SITE_ORIGIN}${ko('/learn/fixture-article')}`,
    );
  });
});

describe('faqPageJsonLd', () => {
  it('emits nothing at all when the page shows no questions', () => {
    expect(faqPageJsonLd([])).toBeNull();
  });

  it('declares each visible question with its own answer text', () => {
    const block = faqPageJsonLd([
      { question: '블라인드는 사라지나요?', answer: '아닙니다. 건 돈으로 인정됩니다.' },
      { question: '쇼다운까지 가야 하나요?', answer: '아닙니다. 대부분 그 전에 끝납니다.' },
    ]);
    expect(block).not.toBeNull();
    const value = parsed(block as JsonLdObject);
    expect(value['@type']).toBe('FAQPage');
    expect(value['mainEntity']).toEqual([
      {
        '@type': 'Question',
        name: '블라인드는 사라지나요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 건 돈으로 인정됩니다.' },
      },
      {
        '@type': 'Question',
        name: '쇼다운까지 가야 하나요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 대부분 그 전에 끝납니다.' },
      },
    ]);
  });
});

describe('webApplicationJsonLd', () => {
  const block = parsed(
    webApplicationJsonLd({
      path: ko('/tools/pot-odds'),
      name: '팟 오즈 계산기',
      description: '콜하려면 몇 퍼센트는 이겨야 하는지 계산합니다.',
    }),
  );

  it('describes a free, in-browser educational tool at its canonical URL', () => {
    expect(block['@type']).toBe('WebApplication');
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/tools/pot-odds')}`);
    expect(block['applicationCategory']).toBe('EducationalApplication');
    expect(block['operatingSystem']).toBe('Web');
    expect(block['isAccessibleForFree']).toBe(true);
    expect(block['offers']).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'KRW' });
  });

  it('canonicalises away tool filter state given a deep link', () => {
    const deep = parsed(
      webApplicationJsonLd({
        path: ko('/tools/range?hero=BTN&spot=RFI'),
        name: '핸드레인지 탐색기',
        description: '설명',
      }),
    );
    expect(deep['url']).toBe(`${SITE_ORIGIN}${ko('/tools/range')}`);
  });

  it('never claims a rating or a review it does not have', () => {
    expect(block).not.toHaveProperty('aggregateRating');
    expect(block).not.toHaveProperty('review');
  });
});

describe('organizationJsonLd / webSiteJsonLd', () => {
  const org = parsed(organizationJsonLd());
  const site = parsed(webSiteJsonLd());

  it('names the site from the two constants every other absolute URL is built from', () => {
    expect(org['@type']).toBe('Organization');
    expect(org['name']).toBe(SITE_NAME);
    expect(org['url']).toBe(SITE_ORIGIN);
    expect(site['@type']).toBe('WebSite');
    expect(site['name']).toBe(SITE_NAME);
    expect(site['url']).toBe(SITE_ORIGIN);
  });

  it('publishes the SAME organisation an Article embeds, not a second one that looks like it', () => {
    expect(site['publisher']).toEqual(parsed(articleJsonLd(article()))['publisher']);
    // The standalone block is that object plus the context a top-level block needs.
    expect({ ...org, '@context': undefined }).toEqual({
      ...(site['publisher'] as Record<string, unknown>),
      '@context': undefined,
    });
  });

  it('advertises no SearchAction, because /search has no server query endpoint', () => {
    const serialised = JSON.stringify(site);
    expect(serialised).not.toContain('potentialAction');
    expect(serialised).not.toContain('SearchAction');
  });

  it('claims no logo, sameAs, address or contact point it does not have', () => {
    for (const field of ['logo', 'sameAs', 'address', 'contactPoint', 'telephone', 'email']) {
      expect(org, field).not.toHaveProperty(field);
      expect(site, field).not.toHaveProperty(field);
    }
  });
});

describe('itemListJsonLd', () => {
  const ITEMS = [
    { name: '홀덤 한 판의 흐름', path: ko('/learn/holdem-basics') },
    { name: '족보 순서', path: ko('/learn/poker-hand-rankings') },
  ] as const;

  it('emits nothing at all for an empty list', () => {
    expect(itemListJsonLd([])).toBeNull();
  });

  it('numbers the rows 1-based and contiguous, in the order given', () => {
    const block = parsed(itemListJsonLd(ITEMS) as JsonLdObject);
    expect(block['@type']).toBe('ItemList');
    expect(block['numberOfItems']).toBe(2);
    expect(block['itemListElement']).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: '홀덤 한 판의 흐름',
        url: `${SITE_ORIGIN}${ko('/learn/holdem-basics')}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '족보 순서',
        url: `${SITE_ORIGIN}${ko('/learn/poker-hand-rankings')}`,
      },
    ]);
  });

  it('claims no sort order — the four hubs each sort by something schema.org cannot name', () => {
    expect(parsed(itemListJsonLd(ITEMS) as JsonLdObject)).not.toHaveProperty('itemListOrder');
  });

  it('is nested, so it carries no @context of its own', () => {
    expect(parsed(itemListJsonLd(ITEMS) as JsonLdObject)).not.toHaveProperty('@context');
  });
});

describe('definedTermSetJsonLd', () => {
  const TERMS = [
    { name: '패의 묶음 (Range)', description: '한 줄 정의입니다.', path: ko('/glossary/range') },
    { name: '팟 오즈 (Pot Odds)', description: '또 한 줄.', path: ko('/glossary/pot-odds') },
  ] as const;

  it('emits nothing at all when the glossary lists nothing', () => {
    expect(definedTermSetJsonLd('포커 용어 사전', ko('/glossary'), [])).toBeNull();
  });

  it('publishes each term with the heading and the definition the hub prints', () => {
    const block = parsed(
      definedTermSetJsonLd('포커 용어 사전', ko('/glossary'), TERMS) as JsonLdObject,
    );
    expect(block['@type']).toBe('DefinedTermSet');
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/glossary')}`);
    expect(block['hasDefinedTerm']).toEqual([
      {
        '@type': 'DefinedTerm',
        name: '패의 묶음 (Range)',
        description: '한 줄 정의입니다.',
        url: `${SITE_ORIGIN}${ko('/glossary/range')}`,
      },
      {
        '@type': 'DefinedTerm',
        name: '팟 오즈 (Pot Odds)',
        description: '또 한 줄.',
        url: `${SITE_ORIGIN}${ko('/glossary/pot-odds')}`,
      },
    ]);
  });
});

describe('definedTermJsonLd', () => {
  const block = definedTermJsonLd({
    name: '쓰리벳',
    description: '오픈 레이즈에 다시 레이즈하는 것을 말합니다.',
    alternateNames: ['3-Bet', '3벳', '3bet'],
    path: ko('/glossary/three-bet'),
    set: { name: '포커 용어 사전', path: ko('/glossary') },
  });

  it('is a top-level DefinedTerm in the schema.org context', () => {
    expect(block['@context']).toBe('https://schema.org');
    expect(block['@type']).toBe('DefinedTerm');
  });

  it('carries the headword, the definition and the other names the header prints', () => {
    expect(block['name']).toBe('쓰리벳');
    expect(block['description']).toBe('오픈 레이즈에 다시 레이즈하는 것을 말합니다.');
    expect(block['alternateName']).toEqual(['3-Bet', '3벳', '3bet']);
  });

  it('names its own canonical and the set it belongs to, on the site origin', () => {
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/glossary/three-bet')}`);
    const set = block['inDefinedTermSet'] as Record<string, unknown>;
    expect(set['@type']).toBe('DefinedTermSet');
    expect(set['name']).toBe('포커 용어 사전');
    expect(set['url']).toBe(`${SITE_ORIGIN}${ko('/glossary')}`);
    // The nested set is nested: no second @context inside the block.
    expect('@context' in set).toBe(false);
  });

  it('omits alternateName entirely when there are no other names', () => {
    const lone = definedTermJsonLd({
      name: 'VPIP',
      description: '…',
      alternateNames: [],
      path: ko('/glossary/vpip'),
      set: { name: '포커 용어 사전', path: ko('/glossary') },
    });
    expect('alternateName' in lone).toBe(false);
  });
});

describe('collectionPageJsonLd', () => {
  const INPUT = {
    path: ko('/learn'),
    title: '홀덤 처음 배우기',
    description: '픽스처 설명입니다.',
  } as const;

  it('emits nothing when the hub collects nothing — an empty collection is not one', () => {
    expect(collectionPageJsonLd({ ...INPUT, mainEntity: null })).toBeNull();
  });

  it('describes the hub at its own canonical, holding the list it was given', () => {
    const items = itemListJsonLd([{ name: '한 편', path: ko('/learn/holdem-basics') }]);
    const block = parsed(collectionPageJsonLd({ ...INPUT, mainEntity: items }) as JsonLdObject);
    expect(block['@type']).toBe('CollectionPage');
    expect(block['name']).toBe('홀덤 처음 배우기');
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/learn')}`);
    expect(block['mainEntityOfPage']).toEqual({
      '@type': 'WebPage',
      '@id': `${SITE_ORIGIN}${ko('/learn')}`,
    });
    expect(block['isPartOf']).toEqual({
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    });
    expect((block['mainEntity'] as Record<string, unknown>)['@type']).toBe('ItemList');
  });

  it('carries the glossary`s DefinedTermSet just as readily as an ItemList', () => {
    const set = definedTermSetJsonLd('포커 용어 사전', ko('/glossary'), [
      { name: '패의 묶음 (Range)', description: '정의', path: ko('/glossary/range') },
    ]);
    const block = parsed(
      collectionPageJsonLd({
        path: ko('/glossary'),
        title: '포커 용어 사전',
        description: '설명',
        mainEntity: set,
      }) as JsonLdObject,
    );
    expect((block['mainEntity'] as Record<string, unknown>)['@type']).toBe('DefinedTermSet');
  });

  it('strips filter state out of the canonical, like every other block on this site', () => {
    const block = parsed(
      collectionPageJsonLd({
        path: ko('/tools?hero=BTN'),
        title: '무료 포커 도구',
        description: '설명',
        mainEntity: itemListJsonLd([{ name: '아웃 계산기', path: ko('/tools/outs') }]),
      }) as JsonLdObject,
    );
    expect(block['url']).toBe(`${SITE_ORIGIN}${ko('/tools')}`);
  });

  it('claims no date, rating or review', () => {
    const serialised = JSON.stringify(
      collectionPageJsonLd({
        ...INPUT,
        mainEntity: itemListJsonLd([{ name: '한 편', path: ko('/learn/holdem-basics') }]),
      }),
    );
    expect(serialised).not.toContain('datePublished');
    expect(serialised).not.toContain('dateModified');
    expect(serialised).not.toContain('aggregateRating');
    expect(serialised).not.toContain('"review"');
  });
});

describe('serializeJsonLd', () => {
  it('produces JSON a crawler can parse', () => {
    expect(() => JSON.parse(serializeJsonLd(breadcrumbListJsonLd(TRAIL)))).not.toThrow();
  });

  it('escapes `<` so the string can never close the surrounding <script>', () => {
    const hostile = serializeJsonLd({ '@type': 'Thing', name: '</script><img src=x>' });
    expect(hostile).not.toContain('<');
    expect((JSON.parse(hostile) as { name: string }).name).toBe('</script><img src=x>');
  });
});
