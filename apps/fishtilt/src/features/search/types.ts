/**
 * The typed shape this feature searches over — deliberately NOT `AnyContentRecord` itself.
 *
 * Two reasons a separate, flatter type earns its keep here rather than searching the content
 * registry's records directly:
 *
 * 1. **Tools are search targets and are not content.** The six tools under `/tools/*` live in
 *    `src/lib/routes.ts` + `src/features/tools/hub.ts`, not in `src/content/registry/**`, and
 *    have no `ContentKind`. A `SearchRecord` is the one shape both a `ContentRecord` and a
 *    tool route can be turned into, so the matcher (`match.ts`) has exactly one thing to
 *    search, not two.
 * 2. **By the time a record becomes a `SearchRecord`, it is guaranteed indexable-in-this-
 *    sense.** `href` is a plain `string`, never `string | null` — `buildIndex.ts` is the only
 *    place that is allowed to look at a `ContentRecord`'s `status` / `hrefOfContent` /
 *    `RouteEntry.available` and decide whether a record is even eligible to become a
 *    `SearchRecord`. Once one exists, every consumer downstream (the matcher, the results
 *    list) can treat `href` as always safe to link to — there is no second unfinished-check
 *    to remember at render time.
 */
import type { ContentKind } from '../../content/types.js';

/** Every content kind, plus `'tool'` for the six `/tools/*` routes that are search targets
 *  but not content records. */
export type SearchKind = ContentKind | 'tool';

export interface SearchRecord {
  /** Globally unique. A content id for content, `tool:<routeId>` for a tool. */
  readonly id: string;
  readonly kind: SearchKind;
  /** The record's `title`, or a tool route's Korean nav `label`. */
  readonly title: string;
  /** The record's own `description`, or a tool's `TOOL_DESCRIPTION` line. Never generated,
   *  summarised or paraphrased here — see the module doc of `buildIndex.ts`. */
  readonly description: string;
  /** Always a real, live path. `buildIndex.ts` guarantees this by construction — see its
   *  module doc — so no consumer needs to re-check "is this actually finished". */
  readonly href: string;
  /** `concepts` for content; empty for a tool, which has none. */
  readonly concepts: readonly string[];
  /** Glossary only: the term itself, e.g. `'Range'`. */
  readonly term?: string;
  /** Glossary only: other spellings a reader might type, e.g. `'레인지'`. */
  readonly aliases?: readonly string[];
  /** Glossary only: the one-line definition (`GlossaryRecord.shortDefinition`). */
  readonly shortDefinition?: string;
  /** Hands only: the 169-class key, e.g. `'AKs'`. */
  readonly handKey?: string;
}

/** One scored match. Higher `score` sorts first — see `match.ts` for the exact tiers. */
export interface SearchResult {
  readonly record: SearchRecord;
  readonly score: number;
}
