/**
 * The typed half of ADR-0080. Prose lives in MDX under `apps/fishtilt/content/`; the
 * STRUCTURE of every piece — its id, where it sits in the curriculum, what it links to, and
 * whether it may be indexed — lives here as data TypeScript can check and a test can walk.
 *
 * The field list is fixed by the build spec §34 and
 * `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §6.1. Nothing in this file knows React, a
 * URL, or a Korean sentence beyond the piece's own title/description: `graph.ts` turns a
 * record into links and headings, and `src/components/` turns those into markup.
 *
 * ## Why `status` exists, when the spec's field list does not name it
 *
 * 3BetTilt ships ~100 authored pieces across several work packages, and the roadmap the
 * learn hub renders is the whole curriculum, not just the part written so far. Without a
 * status the registry could only hold what exists, which would make `/learn` a one-item
 * list today and would force every later WP to edit the graph's shape rather than only add
 * prose.
 *
 * So a record is `PUBLISHED` (an MDX file backs it, it has a real URL, it may be linked) or
 * `PLANNED` (structure only — it renders as visible "준비 중" text and is NEVER a link, the
 * same honesty gate `src/lib/routes.ts` applies to nav). `content.test.ts` reads the
 * filesystem and fails if a `PUBLISHED` record has no MDX file, so this flag cannot lie —
 * exactly the property `routes.ts`'s `available` has.
 *
 * ## Why `indexable` is separate from `status`
 *
 * They answer different questions. `status` is "does this page exist"; `indexable` is "is
 * there enough here to be worth a search result" (build spec §40 — a page padded out to
 * 100-200 generated characters is a liability, not an asset). A published page can be
 * legitimately thin. `threshold.ts` defines what "enough" means as a measurement rather than
 * a judgement, and `content.test.ts` refuses any `indexable: true` record that does not
 * clear it.
 */

import type { HandStoryHand } from './stories/types.js';

/** The four content kinds the build ships. Each maps to one URL prefix — see `graph.ts`. */
export const CONTENT_KINDS = ['learn', 'blog', 'glossary', 'hands'] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

/**
 * Difficulty, exactly the three the build spec §26 names ("처음 / 초급 / 중급"). Stored as a
 * stable key rather than the Korean word so the label can change without a data migration;
 * `graph.ts` owns the label.
 */
export const CONTENT_LEVELS = ['INTRO', 'BASIC', 'INTERMEDIATE'] as const;

export type ContentLevel = (typeof CONTENT_LEVELS)[number];

/**
 * The subject a piece belongs to. A closed union on purpose: `topic` drives grouping and
 * "related" fallbacks, and a free string would let two pieces about the same thing drift
 * into `'range'` and `'ranges'` with nothing to catch it.
 */
export const CONTENT_TOPICS = [
  'rules',
  'hand-strength',
  'starting-hands',
  'range',
  'position',
  'betting',
  'odds',
  'equity',
] as const;

export type ContentTopic = (typeof CONTENT_TOPICS)[number];

export const CONTENT_STATUSES = ['PUBLISHED', 'PLANNED'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * A content id. Globally unique across all four kinds — `relatedArticles` and `nextLessons`
 * both hold plain ids, so an id that were only unique within its kind could not be resolved
 * without also carrying the kind at every reference site.
 */
export type ContentId = string;

export interface ContentRecord {
  readonly kind: ContentKind;
  readonly id: ContentId;
  /** URL segment under the kind's prefix. Unique within the kind. Latin, lower-kebab. */
  readonly slug: string;
  /** The `<h1>`. Korean. */
  readonly title: string;
  /** The one-sentence answer / meta description. Korean, written for a person (§65). */
  readonly description: string;
  /**
   * The `<title>` / Open Graph title when it should differ from the `<h1>` (`title`),
   * WITHOUT the site suffix. The H1 is written for the reader on the page; this is written
   * for the search result. Omitted = the kind's default (`graph.ts` `seoTitleOf`): a
   * glossary entry and a hand page have a template, a learn lesson falls back to its H1.
   * `seo/metadata.ts` is the only reader; nothing renders it on the page.
   */
  readonly seoTitle?: string;
  /**
   * The meta description when the record's `description` (the on-site deck/card sentence)
   * is not what a search result should show. Omitted = the kind's default
   * (`lib/seo/contentSeo.ts` `seoDescriptionOf`). Nothing renders it on the page.
   */
  readonly seoDescription?: string;
  readonly level: ContentLevel;
  readonly topic: ContentTopic;
  /**
   * Free-form concept tags, used for "same idea" grouping and (later) search. Not a link
   * target — unlike every `*` field below, these are NOT content ids and are not resolved.
   */
  readonly concepts: readonly string[];
  /** Content ids a reader should ideally have read first. Rendered early on the page (§35). */
  readonly prerequisites: readonly ContentId[];
  /** Glossary content ids this piece leans on. */
  readonly relatedConcepts: readonly ContentId[];
  /** Route ids from `src/lib/routes.ts` — never raw paths. Checked by `content.test.ts`. */
  readonly relatedTools: readonly string[];
  /** Content ids of kind `'hands'`. */
  readonly relatedHands: readonly ContentId[];
  /** Content ids of kind `'learn'` — where to go next. */
  readonly nextLessons: readonly ContentId[];
  /** Content ids of kind `'blog'` (or `'learn'`) that read well beside this one. */
  readonly relatedArticles: readonly ContentId[];
  /** See the module doc. `PUBLISHED` is verified against disk by `content.test.ts`. */
  readonly status: ContentStatus;
  /** See the module doc. `true` is verified against `threshold.ts` by `content.test.ts`. */
  readonly indexable: boolean;
  /**
   * Estimated reading time in minutes, shown on the hub and the lesson header (§26).
   * NOT a free-hand guess: for a `PUBLISHED` record `content.test.ts` asserts this equals
   * `estimateReadMinutes()` applied to the piece's own measured prose length, so the number
   * on screen is derived from the text that is actually there. `null` for `PLANNED` records,
   * which have no text to measure yet.
   */
  readonly readMinutes: number | null;
}

/** A lesson. Ordered — `order` is what the `/learn` roadmap sorts by. */
export interface LearnRecord extends ContentRecord {
  readonly kind: 'learn';
  /** 1-based position in the curriculum. Unique and gapless across all lessons. */
  readonly order: number;
}

/** One glossary term. */
export interface GlossaryRecord extends ContentRecord {
  readonly kind: 'glossary';
  /**
   * The term as it is written in poker — Latin notation stays Latin (ADR-0053), e.g.
   * `'3-Bet'`, `'Range'`. `title` is the Korean-first heading; this is the term itself.
   */
  readonly term: string;
  /**
   * Other spellings a reader might search or say — `'쓰리벳'`, `'3벳'`, `'레인지'` (§31).
   * Unique across the whole glossary AND distinct from every term: two entries claiming the
   * same alias would make a lookup ambiguous, so `content.test.ts` forbids it.
   */
  readonly aliases: readonly string[];
  /**
   * The one-line definition a `<Term>` popover shows inline, without navigating. Kept in the
   * registry rather than the MDX because the popover has to render it inside another page's
   * prose, where that entry's MDX is not loaded.
   */
  readonly shortDefinition: string;
  /**
   * The word a Korean reader actually types before "뜻", when the H1's headword is not it
   * (`쓰리벳` -> `3벳`, `판에 자발적으로 들어간 비율` -> `VPIP`). Feeds the glossary title
   * template in `graph.ts` `seoTitleOf`. Omitted = derived from `title`.
   */
  readonly seoTerm?: string;
}

/**
 * The five editorial content types the blog hub is organised by (D-S3-19). A closed union
 * on a record field rather than a route: the hub renders one section per type plus an
 * anchor nav, and nothing in `sitemap`, the keyword map or the route registry changes when
 * an article moves between types. The Korean label lives in `graph.ts`
 * (`BLOG_CONTENT_TYPE_LABEL`), like every other label.
 *
 * Declared in hub order: stories first (the editorial pillar), then the search engine's
 * content, then the three supporting types.
 */
export const BLOG_CONTENT_TYPES = [
  'hand-story',
  'search-guide',
  'beginner-mistake',
  'data-probability',
  'concept-culture',
] as const;

export type BlogContentType = (typeof BLOG_CONTENT_TYPES)[number];

export interface BlogRecord extends ContentRecord {
  readonly kind: 'blog';
  /** Which of the five hub sections this article belongs to. See `BLOG_CONTENT_TYPES`. */
  readonly contentType: BlogContentType;
  /**
   * Present on exactly the records whose `contentType` is `'hand-story'` — the reconstructed
   * hand the story template renders from data (D-S3-20). `stories/validate.ts` is the gate;
   * `registry/blog/stories/stories.test.ts` runs every registry story through it.
   */
  readonly hand?: HandStoryHand;
}

/**
 * A hand story: a blog record that carries the hand. The narrowing is by `contentType`
 * AND the presence of `hand`; `isHandStory` in `graph.ts` is the one place that check is
 * written, and the stories test refuses a `'hand-story'` record without a hand (or a hand
 * on any other type).
 */
export interface HandStoryRecord extends BlogRecord {
  readonly contentType: 'hand-story';
  readonly hand: HandStoryHand;
}

/** One of the 169 starting-hand pages. */
export interface HandRecord extends ContentRecord {
  readonly kind: 'hands';
  /** The class key, e.g. `'AKs'`. Resolved against `strategy-core`'s 169 by the test. */
  readonly handKey: string;
}

export type AnyContentRecord = LearnRecord | GlossaryRecord | BlogRecord | HandRecord;
