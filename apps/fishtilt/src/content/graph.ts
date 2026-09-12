/**
 * The content graph — resolution and traversal over `registry/`.
 *
 * Everything that turns a record into something a reader can click goes through here, so
 * there is exactly one answer to "what is this piece's URL", "may it be linked yet", and
 * "what heading goes above this list of links". `RelatedContent`, the learn hub, the lesson
 * template and the tests all read the same functions; none of them re-derives a path.
 *
 * ## Two rules this module exists to enforce
 *
 * **A planned piece is never a link.** `hrefOfContent` returns `null` for a `PLANNED`
 * record, and every component treats `null` as "render visible 준비 중 text, not an anchor".
 * That is the same gate `src/lib/routes.ts` applies to navigation, for the same reason: a
 * link to a page that 404s is a broken promise, and hiding unbuilt work makes the site look
 * emptier than it is. It is also what makes the "no dead internal link" test true by
 * construction rather than by vigilance.
 *
 * **A tool link is a route id, never a path.** `relatedTools` holds ids from
 * `src/lib/routes.ts`; this module resolves them. A content record therefore cannot invent
 * `/tools/rnage`, and when a tool ships, every article that pointed at it becomes a live
 * link with no content edit at all.
 *
 * ## Contextual headings (§76)
 *
 * The build spec bans a generic "관련 글" list outright. So the heading is a property of the
 * RELATION, not of the component: "이제 이것도 이해해보세요" over next lessons, "직접
 * 눌러보고 확인해볼까요?" over tools. `RELATION_HEADING` below is the only place those
 * sentences exist.
 */
import { APP_LOCALE_SEGMENT, DEFAULT_LOCALE, localePath } from '../lib/locale.js';
import { routeById, type RouteEntry } from '../lib/routes.js';
import { ALL_CONTENT } from './registry/index.js';
import type {
  AnyContentRecord,
  BlogContentType,
  BlogRecord,
  ContentId,
  ContentKind,
  ContentLevel,
  GlossaryRecord,
  HandStoryRecord,
  LearnRecord,
} from './types.js';
import { BLOG_CONTENT_TYPES } from './types.js';

/* ------------------------------------------------------------------------------------- */
/* Lookup                                                                                  */
/* ------------------------------------------------------------------------------------- */

const BY_ID: ReadonlyMap<ContentId, AnyContentRecord> = new Map(
  ALL_CONTENT.map((record) => [record.id, record]),
);

/** `undefined` for an unknown id — the form the graph tests use to report dangling refs. */
export function findContent(id: ContentId): AnyContentRecord | undefined {
  return BY_ID.get(id);
}

/** Throws for an unknown id rather than returning something plausible (CLAUDE.md rule 5). */
export function contentById(id: ContentId): AnyContentRecord {
  const record = BY_ID.get(id);
  if (!record) throw new Error(`No such content id: "${id}"`);
  return record;
}

export function contentOfKind(kind: ContentKind): readonly AnyContentRecord[] {
  return ALL_CONTENT.filter((record) => record.kind === kind);
}

export function contentBySlug(kind: ContentKind, slug: string): AnyContentRecord | undefined {
  return ALL_CONTENT.find((record) => record.kind === kind && record.slug === slug);
}

/** Lessons in curriculum order — what `/learn` renders. */
export const LEARN_ROADMAP: readonly LearnRecord[] = ALL_CONTENT.filter(
  (record): record is LearnRecord => record.kind === 'learn',
).toSorted((a, b) => a.order - b.order);

/** The lessons that actually have prose today. `generateStaticParams` reads this. */
export const PUBLISHED_LESSONS: readonly LearnRecord[] = LEARN_ROADMAP.filter(
  (lesson) => lesson.status === 'PUBLISHED',
);

/**
 * Every record of a kind that actually has prose today — the generalised form of
 * `PUBLISHED_LESSONS` for `/blog`, `/glossary` and `/hands`'s `generateStaticParams`. Kept
 * here rather than re-derived per route so every list/detail template agrees on what
 * "published" means for its kind.
 */
export function publishedOfKind(kind: ContentKind): readonly AnyContentRecord[] {
  return contentOfKind(kind).filter((record) => record.status === 'PUBLISHED');
}

/* ------------------------------------------------------------------------------------- */
/* Blog: content types and stories (D-S3-19 / D-S3-20)                                    */
/* ------------------------------------------------------------------------------------- */

/** Every blog record, registry order — stories included (they ARE blog records). */
export function blogRecords(): readonly BlogRecord[] {
  return ALL_CONTENT.filter((record): record is BlogRecord => record.kind === 'blog');
}

/** The blog records of one content type, registry order. */
export function blogOfType(contentType: BlogContentType): readonly BlogRecord[] {
  return blogRecords().filter((record) => record.contentType === contentType);
}

/**
 * The one place the "is this a hand story" check is written: the type says so AND the hand
 * is present. `stories.test.ts` refuses a record that satisfies one half only, so at runtime
 * the two never disagree — but the template narrows through this rather than trusting a
 * string, because a story template handed a record with no hand would have nothing to draw.
 */
export function isHandStory(record: AnyContentRecord): record is HandStoryRecord {
  return record.kind === 'blog' && record.contentType === 'hand-story' && record.hand !== undefined;
}

/** The stories that have prose today — what the hub's story slots may feature. */
export function publishedStories(): readonly HandStoryRecord[] {
  return blogRecords().filter(
    (record): record is HandStoryRecord => isHandStory(record) && record.status === 'PUBLISHED',
  );
}

/** The `<title>` for a record: a blog record's `seoTitle` when set, else its H1. */
export function seoTitleOf(record: AnyContentRecord): string {
  return record.kind === 'blog' && record.seoTitle !== undefined ? record.seoTitle : record.title;
}

/**
 * The previous and next PUBLISHED article of the same content type, registry order — what
 * `NextRead` renders under a blog article. Registry order is a fact about the data, not a
 * ranking, which is the only kind of order this site may put on screen (see `/blog`).
 */
export function blogNeighbours(record: BlogRecord): {
  readonly prev: BlogRecord | null;
  readonly next: BlogRecord | null;
} {
  const siblings = blogOfType(record.contentType).filter((entry) => entry.status === 'PUBLISHED');
  const index = siblings.findIndex((entry) => entry.id === record.id);
  if (index === -1) return { prev: null, next: null };
  return { prev: siblings[index - 1] ?? null, next: siblings[index + 1] ?? null };
}

export function glossaryRecords(): readonly GlossaryRecord[] {
  return ALL_CONTENT.filter((record): record is GlossaryRecord => record.kind === 'glossary');
}

/** The glossary entry behind a `<Term>`, or `undefined` if the id is not a glossary term. */
export function glossaryById(id: ContentId): GlossaryRecord | undefined {
  const record = BY_ID.get(id);
  return record !== undefined && record.kind === 'glossary' ? record : undefined;
}

/* ------------------------------------------------------------------------------------- */
/* URLs                                                                                    */
/* ------------------------------------------------------------------------------------- */

/**
 * The SITE-path prefix each kind lives under (audit §4's route map) — locale-less, like
 * `RouteEntry.sitePath`. `contentPath` puts the locale in front; nothing else reads this
 * except the filesystem checks in `content.test.ts`.
 */
export const CONTENT_PREFIX: Readonly<Record<ContentKind, string>> = {
  learn: '/learn',
  blog: '/blog',
  glossary: '/glossary',
  hands: '/hands',
};

/**
 * The App Router template that must exist on disk before a piece of this kind can be
 * `PUBLISHED`. Checked by `content.test.ts` — a published record whose route template does
 * not exist would be a dead link the moment something pointed at it.
 */
export const CONTENT_ROUTE_TEMPLATE: Readonly<Record<ContentKind, string>> = {
  learn: `${APP_LOCALE_SEGMENT}/learn/[slug]`,
  blog: `${APP_LOCALE_SEGMENT}/blog/[slug]`,
  glossary: `${APP_LOCALE_SEGMENT}/glossary/[slug]`,
  hands: `${APP_LOCALE_SEGMENT}/hands/[hand]`,
};

/**
 * The path a piece WOULD live at, whether or not it exists yet — localised, like
 * `RouteEntry.path`: `'/ko/learn/pot-odds'`. This is the one place a content URL is built.
 */
export function contentPath(record: AnyContentRecord): string {
  return localePath(DEFAULT_LOCALE, `${CONTENT_PREFIX[record.kind]}/${record.slug}`);
}

/** The path to link to, or `null` when the piece is not written yet. See the module doc. */
export function hrefOfContent(record: AnyContentRecord): string | null {
  return record.status === 'PUBLISHED' ? contentPath(record) : null;
}

/**
 * A deep link into a tool, e.g.
 * `toolHref('range', { hero: 'BTN', spot: 'RFI', stack: '100' })` →
 * `/tools/range?hero=BTN&spot=RFI&stack=100` (build spec §51/§75).
 *
 * `null` when the tool is not built yet, exactly like `hrefOfContent`. Parameters are
 * encoded through `URLSearchParams`, so a value can never break out of the query string.
 */
export function toolHref(
  routeId: string,
  params?: Readonly<Record<string, string>>,
): string | null {
  const route = routeById(routeId);
  if (!route.available) return null;
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return route.path;
  const query = new URLSearchParams(entries).toString();
  return `${route.path}?${query}`;
}

/** The route entry behind a `relatedTools` id. Throws for an unknown id. */
export function toolRoute(routeId: string): RouteEntry {
  return routeById(routeId);
}

/* ------------------------------------------------------------------------------------- */
/* Labels                                                                                  */
/* ------------------------------------------------------------------------------------- */

export const LEVEL_LABEL: Readonly<Record<ContentLevel, string>> = {
  INTRO: '처음',
  BASIC: '초급',
  INTERMEDIATE: '중급',
};

/**
 * The Korean label for each blog content type (D-S3-19; the audit's proposed labels). The
 * hub section headings, the anchor nav, the article meta and `articleSection` in JSON-LD
 * all read this map, so a type can be renamed in one line.
 */
export const BLOG_CONTENT_TYPE_LABEL: Readonly<Record<BlogContentType, string>> = {
  'hand-story': '핸드 스토리',
  'search-guide': '검색 가이드',
  'beginner-mistake': '초보자 실수',
  'data-probability': '데이터와 확률',
  'concept-culture': '포커 개념·문화',
};

/**
 * The in-page anchor for each hub section (`/blog#hand-stories`). Anchors, not routes —
 * D-S3-19 rules out category URLs until Search Console proves a need.
 */
export const BLOG_CONTENT_TYPE_ANCHOR: Readonly<Record<BlogContentType, string>> = {
  'hand-story': 'hand-stories',
  'search-guide': 'search-guides',
  'beginner-mistake': 'beginner-mistakes',
  'data-probability': 'data-probability',
  'concept-culture': 'concepts-culture',
};

/** Hub order — the order `BLOG_CONTENT_TYPES` is declared in. */
export const BLOG_CONTENT_TYPE_ORDER: readonly BlogContentType[] = BLOG_CONTENT_TYPES;

export const KIND_LABEL: Readonly<Record<ContentKind, string>> = {
  learn: '배우기',
  blog: '읽을거리',
  glossary: '용어',
  hands: '핸드',
};

/** `"초급 · 약 6분"` — the meta line under a lesson title. Omits what it does not know. */
export function contentMeta(record: AnyContentRecord): string {
  const parts = [LEVEL_LABEL[record.level]];
  if (record.readMinutes !== null) parts.push(`약 ${record.readMinutes}분`);
  return parts.join(' · ');
}

/* ------------------------------------------------------------------------------------- */
/* Relations                                                                               */
/* ------------------------------------------------------------------------------------- */

export const RELATION_KINDS = [
  'prerequisites',
  'relatedConcepts',
  'relatedTools',
  'relatedHands',
  'nextLessons',
  'relatedArticles',
] as const;

export type RelationKind = (typeof RELATION_KINDS)[number];

/**
 * The contextual heading for each relation (§76). Never "관련 글" — the heading has to tell
 * the reader what the list is FOR, in the voice of the moment they have reached.
 */
export const RELATION_HEADING: Readonly<Record<RelationKind, string>> = {
  prerequisites: '먼저 알고 오면 훨씬 쉬워요',
  relatedConcepts: '이 글에 나온 말들',
  relatedTools: '직접 눌러보고 확인해볼까요?',
  relatedHands: '이 핸드도 같이 보세요',
  nextLessons: '이제 이것도 이해해보세요',
  relatedArticles: '이 개념과 같이 보면 쉬워요',
};

/** One resolved destination. `href: null` means "exists as a plan, not yet as a page". */
export interface ContentLink {
  readonly key: string;
  readonly label: string;
  readonly description: string | null;
  readonly href: string | null;
  /** Small print beside the label — level and reading time, or the tool's section. */
  readonly meta: string | null;
}

export interface ContentRelation {
  readonly relation: RelationKind;
  readonly heading: string;
  readonly links: readonly ContentLink[];
}

function linkOfContent(record: AnyContentRecord): ContentLink {
  return {
    key: record.id,
    label: record.title,
    description: record.description,
    href: hrefOfContent(record),
    meta: record.kind === 'learn' ? contentMeta(record) : KIND_LABEL[record.kind],
  };
}

function linkOfTool(routeId: string): ContentLink {
  const route = routeById(routeId);
  return {
    key: `tool:${routeId}`,
    label: route.label,
    description: null,
    href: route.available ? route.path : null,
    meta: '무료 도구',
  };
}

/** The ids a relation holds, unresolved. Used by the graph tests to find dangling refs. */
export function referencedIds(record: AnyContentRecord, relation: RelationKind): readonly string[] {
  return record[relation];
}

/**
 * Every relation of a record that actually has something in it, in `RELATION_KINDS` order.
 * A relation with no entries is omitted entirely rather than rendered as an empty heading.
 *
 * `only` narrows the result — the lesson template renders `prerequisites` early, near the
 * lead, and the rest at the foot, so it asks for each set separately.
 */
export function relationsOf(
  record: AnyContentRecord,
  only?: readonly RelationKind[],
): readonly ContentRelation[] {
  const wanted = only ?? RELATION_KINDS;
  const relations: ContentRelation[] = [];
  for (const relation of RELATION_KINDS) {
    if (!wanted.includes(relation)) continue;
    const links =
      relation === 'relatedTools'
        ? record.relatedTools.map(linkOfTool)
        : record[relation].map((id) => linkOfContent(contentById(id)));
    if (links.length > 0) {
      relations.push({ relation, heading: RELATION_HEADING[relation], links });
    }
  }
  return relations;
}
