/**
 * Grouping already-ranked results by kind for `/search`'s sectioned result list (Stage 3
 * contract BG: "results grouped Learn / Blog / Glossary / Hands / Tools with clear group
 * headers and counts").
 *
 * ## Why the groups are ordered by their best hit, not by a fixed kind order
 *
 * The flat list this replaces made one promise — "position 1 is always the best match" —
 * and a fixed group order (learn, blog, glossary, hands, tool) would break it for exactly
 * the query it matters most for: `3벳` is an exact glossary alias, but the LEARN group would
 * sit above it because learn comes first. So the groups are sorted by the best score inside
 * each, which puts the group holding the overall best match first, and inside a group the
 * order is the matcher's own. `SEARCH_KIND_ORDER` only breaks ties between groups whose best
 * hits score the same.
 *
 * Pure: `matchQuery`'s output in, `SearchResultGroup[]` out. Never re-scores.
 */
import { SEARCH_KIND_ORDER, searchKindLabel } from './copy.js';
import type { SearchKind, SearchResult } from './types.js';

export interface SearchResultGroup {
  readonly kind: SearchKind;
  /** The Korean group heading — `searchKindLabel(kind)`. */
  readonly label: string;
  /** In the matcher's order: best first. */
  readonly results: readonly SearchResult[];
  /** The group's top score — what the groups are ordered by. */
  readonly bestScore: number;
}

export function groupResults(results: readonly SearchResult[]): readonly SearchResultGroup[] {
  const byKind = new Map<SearchKind, SearchResult[]>();
  for (const result of results) {
    const bucket = byKind.get(result.record.kind);
    if (bucket) bucket.push(result);
    else byKind.set(result.record.kind, [result]);
  }

  const groups: SearchResultGroup[] = [];
  for (const [kind, bucket] of byKind) {
    groups.push({
      kind,
      label: searchKindLabel(kind),
      results: bucket,
      bestScore: bucket.reduce((best, result) => Math.max(best, result.score), 0),
    });
  }

  const rank = (kind: SearchKind): number => {
    const index = SEARCH_KIND_ORDER.indexOf(kind);
    return index === -1 ? SEARCH_KIND_ORDER.length : index;
  };
  return groups.toSorted((a, b) => b.bestScore - a.bestScore || rank(a.kind) - rank(b.kind));
}
