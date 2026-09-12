/**
 * The matcher — the pure function this whole feature is really about. Takes a record LIST as
 * an argument rather than reaching for a module-scope registry, specifically so it is
 * testable against small fixtures the test file constructs itself: this app's content
 * registry is being written concurrently by other agents, and an assertion like "searching
 * 팟 returns 3 results" would silently start failing (or silently start passing for the wrong
 * reason) the moment a batch ships (`docs/FISHTILT_STATE.md` ruling 26). `buildIndex.ts`
 * wires the real registry into this function for the shipped page; `match.test.ts` never
 * imports it.
 *
 * ## Ranking, in one sentence
 *
 * A record's score is `primaryTier * 100 + secondaryTier * 10 + conceptTier`, where each tier
 * is 0 (no match) / 1 (contains) / 2 (starts with) / 3 (exact) — so ANY primary-field match
 * outranks every possible secondary-field match (which tops out at 30), and any secondary
 * match outranks every possible concept-only match (which tops out at 3). That is what makes
 * "exact title/term/alias hit above a description hit above a concept hit" true by
 * construction rather than by tuning: the three field groups can never cross tiers, no matter
 * how the within-group score compares.
 *
 * - **Primary fields** (weight 100): `title`, and for glossary also `term` and every
 *   `aliases` entry, and for hands also `handKey`. These are the fields a beginner is
 *   thinking of when they type — the name of the thing.
 * - **Secondary fields** (weight 10): `description`, and for glossary also `shortDefinition`
 *   — the record's own one-line summary, not a name.
 * - **Concept fields** (weight 1): `concepts` — tags, the loosest signal.
 *
 * A record with score 0 (no field matched at even the CONTAINS level) is dropped entirely,
 * never returned at a token "0% match".
 *
 * ## Aliases (Stage 3)
 *
 * The query is first expanded by `aliases.ts` into every spelling the glossary and the
 * search layer know to be the same thing (`쓰리벳` → `3벳 · 3-bet · 3bet · three-bet · …`),
 * and a record's score is the BEST any variant earns. The tiers are unchanged — a lesson
 * whose title says `(3-Bet)` earns the same primary-tier score for `쓰리벳` that it earns for
 * `3-bet`, because for the reader those are one word. Expansion never lowers a score and
 * never invents a match: a variant only exists through an exact hit on a known spelling.
 */
import { expandQuery } from './aliases.js';
import { compact, normalizeText } from './normalize.js';
import type { SearchRecord, SearchResult } from './types.js';

/** One field's match strength against the query. Exported so the report's tier table and
 *  `match.test.ts` can both refer to the same named levels rather than magic numbers. */
export const FIELD_SCORE = {
  NONE: 0,
  CONTAINS: 1,
  PREFIX: 2,
  EXACT: 3,
} as const;

/** How much each field GROUP's best field-score counts toward the total — see the module
 *  doc for why these three weights can never let a lower group outrank a higher one. */
const GROUP_WEIGHT = {
  primary: 100,
  secondary: 10,
  concept: 1,
} as const;

function fieldScore(value: string, queryNormalized: string, queryCompact: string): number {
  if (value === '') return FIELD_SCORE.NONE;
  const normalizedValue = normalizeText(value);
  const compactValue = compact(value);
  if (normalizedValue === queryNormalized || compactValue === queryCompact) {
    return FIELD_SCORE.EXACT;
  }
  if (compactValue.startsWith(queryCompact)) return FIELD_SCORE.PREFIX;
  if (compactValue.includes(queryCompact)) return FIELD_SCORE.CONTAINS;
  return FIELD_SCORE.NONE;
}

function bestOf(values: readonly string[], queryNormalized: string, queryCompact: string): number {
  let best: number = FIELD_SCORE.NONE;
  for (const value of values) {
    const score = fieldScore(value, queryNormalized, queryCompact);
    if (score > best) best = score;
  }
  return best;
}

function primaryFieldsOf(record: SearchRecord): readonly string[] {
  const fields: string[] = [record.title];
  if (record.term !== undefined) fields.push(record.term);
  if (record.handKey !== undefined) fields.push(record.handKey);
  if (record.aliases !== undefined) fields.push(...record.aliases);
  return fields;
}

function secondaryFieldsOf(record: SearchRecord): readonly string[] {
  const fields: string[] = [record.description];
  if (record.shortDefinition !== undefined) fields.push(record.shortDefinition);
  return fields;
}

/** Score one record against an already-normalised query. `0` means "does not match". */
function scoreRecord(record: SearchRecord, queryNormalized: string, queryCompact: string): number {
  const primary = bestOf(primaryFieldsOf(record), queryNormalized, queryCompact);
  const secondary = bestOf(secondaryFieldsOf(record), queryNormalized, queryCompact);
  const concept = bestOf(record.concepts, queryNormalized, queryCompact);
  return (
    primary * GROUP_WEIGHT.primary +
    secondary * GROUP_WEIGHT.secondary +
    concept * GROUP_WEIGHT.concept
  );
}

/**
 * Total. `records` is supplied by the caller — see the module doc. Returns `[]` for an
 * empty/whitespace-only query (nothing has been asked yet, distinct from "asked and found
 * nothing" — `SearchClient` renders these two states with different copy) and for a query
 * that matches nothing.
 *
 * Ties (equal score) break on the Korean-locale ordering of `title`, the same collation
 * `/glossary` already sorts by, so the result order is stable and unsurprising rather than
 * an accident of registry insertion order.
 */
export function matchQuery(
  records: readonly SearchRecord[],
  rawQuery: string,
): readonly SearchResult[] {
  if (compact(rawQuery) === '') return [];
  const variants = expandQuery(records, rawQuery).map((variant) => ({
    normalized: normalizeText(variant),
    compacted: compact(variant),
  }));

  const results: SearchResult[] = [];
  for (const record of records) {
    let score = 0;
    for (const variant of variants) {
      const candidate = scoreRecord(record, variant.normalized, variant.compacted);
      if (candidate > score) score = candidate;
    }
    if (score > 0) results.push({ record, score });
  }
  return results.toSorted(
    (a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, 'ko'),
  );
}
