/**
 * The index / noindex policy (build spec §33), expressed as two total functions over data
 * the project already maintains.
 *
 * There is no deny list here, and that is the point. A hand-written list of URLs not to
 * index is a second registry that has to be kept in step with the first, and the failure
 * mode is silent: the day someone adds a route or publishes a thin page, the list is
 * already wrong and nothing says so. So both decisions are read off existing, already-
 * verified data:
 *
 * - **A content page** is indexed when the registry says it is: `status === 'PUBLISHED'`
 *   (verified against the filesystem by `content.test.ts`) AND `indexable === true`
 *   (verified against `threshold.ts`'s measurements by the same test). WP-N does not get
 *   to redefine either flag, and never edits a record to change what gets indexed — if a
 *   page is too thin to deserve a search result, the answer is `noindex`, not filler
 *   (`docs/FISHTILT_STATE.md` ruling 68).
 * - **A static route** is indexed when the registry says it exists (`available`, verified
 *   against the filesystem in both directions by `routes.test.ts`) and its SECTION is a
 *   kind of page that should be in an index at all.
 *
 * ## The one editorial judgement, and where it lives
 *
 * `SECTION_INDEXABLE` below is that judgement, and it is a judgement about a KIND of page,
 * not about any particular URL — which is why it is eight lines rather than a hundred. §33
 * forbids indexing search result pages, so `search` is `false`. Everything else the
 * registry can hold is a real destination with its own content.
 *
 * ## What §33's other exclusions turn out to be
 *
 * - *arbitrary filter combinations* — every filter on this site is client state applied
 *   with `history.replaceState` (`RangeExplorer`, `StartingHandExplorer`, `SearchClient`);
 *   no page reads `searchParams`, so a filtered view is never a distinct rendered
 *   document. `canonical.ts` additionally points every one of them back at the bare tool
 *   URL, so a crawler that arrives with a query string is told which URL is the document.
 * - *quiz result states* — `Quiz`/`RangeQuiz` hold score and answers in React state and
 *   write nothing to the URL, so a result state has no URL to index. The quiz LANDING
 *   pages are ordinary pages and are indexed.
 * - *thin generated hands / empty ranges* — a hand page carries `indexable` like every
 *   other content record and is measured by the same threshold. Nothing on this site
 *   generates a page per range filter (ruling 67).
 */
import { ROUTES, type RouteEntry, type RouteSection } from '../routes.js';
import type { AnyContentRecord } from '../../content/types.js';

/**
 * Whether a section of the site is the kind of thing that belongs in a search index.
 * Exhaustive over `RouteSection` by type, so adding a section to the registry without
 * deciding this is a compile error rather than an omission.
 */
export const SECTION_INDEXABLE: Readonly<Record<RouteSection, boolean>> = {
  home: true,
  learn: true,
  tools: true,
  practice: true,
  glossary: true,
  blog: true,
  hands: true,
  about: true,
  // Build spec §33: search result pages are not indexed. `/search` renders no content of
  // its own — it is an interface onto content that is already indexed at its own URL.
  search: false,
};

/** Why a decision came out the way it did. Surfaced by the tests and the report. */
export type IndexReason =
  | 'INDEXED'
  | 'ROUTE_NOT_AVAILABLE'
  | 'SECTION_NOT_INDEXABLE'
  | 'CONTENT_NOT_PUBLISHED'
  | 'CONTENT_BELOW_THRESHOLD';

export interface IndexDecision {
  readonly index: boolean;
  readonly reason: IndexReason;
}

const INDEXED: IndexDecision = { index: true, reason: 'INDEXED' };

/** The decision for one static route in `src/lib/routes.ts`. */
export function routeIndexDecision(route: RouteEntry): IndexDecision {
  if (!route.available) return { index: false, reason: 'ROUTE_NOT_AVAILABLE' };
  if (!SECTION_INDEXABLE[route.section]) return { index: false, reason: 'SECTION_NOT_INDEXABLE' };
  return INDEXED;
}

/** The decision for one content record. Reads the registry's flags; never overrides them. */
export function contentIndexDecision(record: AnyContentRecord): IndexDecision {
  if (record.status !== 'PUBLISHED') return { index: false, reason: 'CONTENT_NOT_PUBLISHED' };
  if (!record.indexable) return { index: false, reason: 'CONTENT_BELOW_THRESHOLD' };
  return INDEXED;
}

/** Every static route that may be indexed, in registry order. */
export function indexableRoutes(routes: readonly RouteEntry[] = ROUTES): readonly RouteEntry[] {
  return routes.filter((route) => routeIndexDecision(route).index);
}

/** Every content record that may be indexed, in registry order. */
export function indexableContent(
  records: readonly AnyContentRecord[],
): readonly AnyContentRecord[] {
  return records.filter((record) => contentIndexDecision(record).index);
}
