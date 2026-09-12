/**
 * The blog hub as data (WP-S3-06, contract AG). Pure: registry in, a fully decided page
 * model out, so the page's choices are unit-testable without rendering and the JSON-LD
 * `ItemList` is built from the same arrays the JSX maps.
 *
 * ## What may be claimed
 *
 * Nothing here ranks. There is no date on any record (ruling 105) and no analytics, so
 * "최신", "인기" and "많이 읽은" are impossible statements and the hub never makes them. The
 * orders on the page are all facts about the data: content-type order is the declared
 * union, and the order inside a section is registry order. The one editorial slot — the
 * featured article — is a deterministic pick (the first published story; with none, the
 * first published search guide) and is labelled as a place to start, not as a best.
 *
 * ## How story slots degrade
 *
 * With zero published stories the featured slot features a search guide, the story section
 * is not rendered, and the category nav shows 핸드 스토리 as 준비 중 without a link. No slot
 * ever invents a story (rule 3, D-S3-20).
 */
import {
  BLOG_CONTENT_TYPE_ANCHOR,
  BLOG_CONTENT_TYPE_LABEL,
  BLOG_CONTENT_TYPE_ORDER,
  blogRecords,
  hrefOfContent,
} from '../../content/graph.js';
import type { BlogContentType, BlogRecord } from '../../content/types.js';

/** How the section for a content type lays its articles out. Varied on purpose (D-S3-17). */
export type HubSectionLayout = 'stories' | 'rows' | 'data' | 'titles';

export const HUB_SECTION_LAYOUT: Readonly<Record<BlogContentType, HubSectionLayout>> = {
  'hand-story': 'stories',
  'search-guide': 'rows',
  'beginner-mistake': 'rows',
  'data-probability': 'data',
  'concept-culture': 'titles',
};

/** One sentence under each section heading — what the type is FOR, in the hub's voice. */
export const HUB_SECTION_DESCRIPTION: Readonly<Record<BlogContentType, string>> = {
  'hand-story':
    '한 판을 처음부터 끝까지 따라가는 이야기. 카드와 팟은 전부 기록에서 그대로 그립니다. 학습과 재미를 위해 재구성한 핸드 시나리오입니다.',
  'search-guide':
    '검색창에 치는 질문 하나에 끝까지 답하는 글. 답부터 읽고, 필요한 만큼만 내려갑니다.',
  'beginner-mistake': '누구나 한 번쯤 하는 실수를 규칙과 숫자로 풀어 봅니다.',
  'data-probability': '확률, 조합 수, 순위표. 숫자는 전부 이 사이트가 직접 계산한 값입니다.',
  'concept-culture': '왜 그렇게 부르는지, 왜 그런 규칙이 있는지 — 용어와 관습의 뒷이야기.',
};

export interface HubNavEntry {
  readonly type: BlogContentType;
  readonly label: string;
  /** `#anchor` when the section is on the page; `null` when the type has nothing yet. */
  readonly href: string | null;
  readonly count: number;
}

export interface HubSection {
  readonly type: BlogContentType;
  readonly label: string;
  readonly anchor: string;
  readonly description: string;
  readonly layout: HubSectionLayout;
  /** Every article of the type, registry order — `PLANNED` included, as inert rows. */
  readonly articles: readonly BlogRecord[];
}

export interface BlogHubModel {
  readonly total: number;
  readonly published: number;
  readonly storyCount: number;
  readonly nav: readonly HubNavEntry[];
  /** The one editorial pick, or `null` when nothing is published at all. */
  readonly featured: BlogRecord | null;
  /** Up to three published articles of OTHER types than the featured one, one per type. */
  readonly secondary: readonly BlogRecord[];
  /** Sections for every type that has at least one article, in hub order. */
  readonly sections: readonly HubSection[];
  /** Types with no article yet, named honestly at the foot of the hub. */
  readonly comingSoon: readonly BlogContentType[];
  /** Every article, hub order — what the 전체 글 index renders. */
  readonly index: readonly BlogRecord[];
}

const SECONDARY_SLOTS = 3;

export function buildBlogHub(articles: readonly BlogRecord[] = blogRecords()): BlogHubModel {
  const ofType = (type: BlogContentType): readonly BlogRecord[] =>
    articles.filter((article) => article.contentType === type);
  const publishedOfType = (type: BlogContentType): readonly BlogRecord[] =>
    ofType(type).filter((article) => article.status === 'PUBLISHED');

  const published = articles.filter((article) => article.status === 'PUBLISHED');
  const stories = publishedOfType('hand-story');

  const featured = stories[0] ?? publishedOfType('search-guide')[0] ?? published[0] ?? null;

  const secondary: BlogRecord[] = [];
  for (const type of BLOG_CONTENT_TYPE_ORDER) {
    if (secondary.length >= SECONDARY_SLOTS) break;
    if (featured !== null && type === featured.contentType) continue;
    const first = publishedOfType(type)[0];
    if (first !== undefined) secondary.push(first);
  }
  // Fewer types than slots: fill from the featured type's remaining articles.
  if (featured !== null) {
    for (const article of publishedOfType(featured.contentType)) {
      if (secondary.length >= SECONDARY_SLOTS) break;
      if (article.id !== featured.id && !secondary.includes(article)) secondary.push(article);
    }
  }

  const sections: HubSection[] = [];
  const comingSoon: BlogContentType[] = [];
  for (const type of BLOG_CONTENT_TYPE_ORDER) {
    const typed = ofType(type);
    if (typed.length === 0) {
      comingSoon.push(type);
      continue;
    }
    sections.push({
      type,
      label: BLOG_CONTENT_TYPE_LABEL[type],
      anchor: BLOG_CONTENT_TYPE_ANCHOR[type],
      description: HUB_SECTION_DESCRIPTION[type],
      layout: HUB_SECTION_LAYOUT[type],
      articles: typed,
    });
  }

  const nav = BLOG_CONTENT_TYPE_ORDER.map((type) => {
    const count = ofType(type).length;
    return {
      type,
      label: BLOG_CONTENT_TYPE_LABEL[type],
      href: count > 0 ? `#${BLOG_CONTENT_TYPE_ANCHOR[type]}` : null,
      count,
    };
  });

  return {
    total: articles.length,
    published: published.length,
    storyCount: stories.length,
    nav,
    featured,
    secondary,
    sections,
    comingSoon,
    index: sections.flatMap((section) => section.articles),
  };
}

/**
 * The `ItemList` rows: every published article exactly once, in the order the page FIRST
 * renders it — the featured pick, then the 이어서 읽기 rail, then the sections/index. Same
 * members as the 전체 글 index; the order is a fact about the page, not a ranking.
 */
export function hubListedItems(model: BlogHubModel): readonly { name: string; path: string }[] {
  const seen = new Set<string>();
  const firstRender = [
    ...(model.featured === null ? [] : [model.featured]),
    ...model.secondary,
    ...model.index,
  ];
  return firstRender.flatMap((article) => {
    if (seen.has(article.id)) return [];
    seen.add(article.id);
    const href = hrefOfContent(article);
    return href === null ? [] : [{ name: article.title, path: href }];
  });
}

/** `"검색 가이드 · 초급 · 약 3분"` — the small print under a hub row. */
export function hubMeta(article: BlogRecord, options: { readonly type?: boolean } = {}): string {
  const parts: string[] = [];
  if (options.type ?? true) parts.push(BLOG_CONTENT_TYPE_LABEL[article.contentType]);
  if (article.readMinutes !== null) parts.push(`약 ${article.readMinutes}분`);
  return parts.join(' · ');
}
